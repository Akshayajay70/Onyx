import Order from '../../model/orderModel.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';

const reportController = {
    getSalesReport: async (req, res) => {
        try {
            const { startDate, endDate, period } = req.query;
            let query = { 
                'items.order.status': { $ne: 'cancelled' },
                'payment.paymentStatus': { $ne: 'failed' }
            };
            let dateRange = {};

            // Handle different period types
            if (period) {
                const now = new Date();
                switch (period) {
                    case 'daily':
                        dateRange.start = new Date(now.setHours(0, 0, 0, 0));
                        dateRange.end = new Date(now.setHours(23, 59, 59, 999));
                        break;
                    case 'weekly':
                        dateRange.start = new Date(now.setDate(now.getDate() - 7));
                        dateRange.end = new Date();
                        break;
                    case 'monthly':
                        dateRange.start = new Date(now.setMonth(now.getMonth() - 1));
                        dateRange.end = new Date();
                        break;
                    case 'yearly':
                        dateRange.start = new Date(now.setFullYear(now.getFullYear() - 1));
                        dateRange.end = new Date();
                        break;
                }
            } else if (startDate && endDate) {
                dateRange.start = new Date(new Date(startDate).setHours(0, 0, 0, 0));
                dateRange.end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
            }

            if (dateRange.start && dateRange.end) {
                query.createdAt = {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                };
            }

            // Fetch orders with date range and populate user data
            const orders = await Order.find(query)
                .populate('userId', 'firstName lastName email')
                .sort({ createdAt: -1 });

            // Calculate metrics
            const metrics = {
                totalOrders: orders.length,
                totalSales: orders.reduce((sum, order) => sum + order.totalAmount, 0),
                totalDiscount: orders.reduce((sum, order) => {
                    const couponDiscount = order.coupon?.discount || 0;
                    return sum + couponDiscount;
                }, 0),
                netRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0)
            };

            // Calculate average order value
            metrics.averageOrderValue = orders.length ? metrics.netRevenue / orders.length : 0;

            // Group orders by date
            const dailyData = orders.reduce((acc, order) => {
                const date = order.createdAt.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = {
                        orders: 0,
                        sales: 0,
                        discount: 0,
                        netRevenue: 0
                    };
                }
                
                acc[date].orders++;
                acc[date].sales += order.totalAmount;
                acc[date].discount += (order.coupon?.discount || 0);
                acc[date].netRevenue += order.totalAmount;
                
                return acc;
            }, {});

            res.render('admin/salesReport', {
                orders,
                metrics,
                dailyData,
                dateRange,
                period: period || 'custom'
            });

        } catch (error) {
            console.error('Sales report error:', error);
            res.status(500).render('error', { message: 'Error generating sales report' });
        }
    },

    downloadExcel: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            const startDay = new Date(startDate);
            const endDay = new Date(endDate);

            const start = new Date(startDay.setHours(23, 59, 59, 999));
            const end = new Date(endDay.setHours(23, 59, 59, 999));

            const orders = await Order.find({
                createdAt: { $gte: start, $lte: end },
                'items.order.status': { $nin: ['pending', 'cancelled'] },
                'payment.paymentStatus': { $nin: ['failed', 'cancelled'] }
            })
            .populate('userId', 'firstName lastName email')
            .populate('items.product', 'productName')
            .lean();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            worksheet.columns = [
                { header: 'Order ID', key: 'orderId', width: 15 },
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Items', key: 'items', width: 30 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Payment Method', key: 'paymentMethod', width: 15 },
                { header: 'Amount', key: 'amount', width: 12 }
            ];

            // Style header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Add data
            orders.forEach(order => {
                worksheet.addRow({
                    orderId: order.orderCode,
                    date: new Date(order.createdAt).toLocaleDateString(),
                    customer: `${order.userId?.firstName || ''} ${order.userId?.lastName || ''}`,
                    items: order.items.map(item => 
                        `${item.quantity}x ${item.product?.productName || 'Unknown'} `
                    ).join('\n'),
                    status: order.items[0]?.order?.status || 'N/A',
                    paymentMethod: `${order.payment.method} (${order.payment.paymentStatus})`,
                    amount: order.totalAmount.toFixed(2)
                });
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.xlsx`);

            // Write to response
            return workbook.xlsx.write(res).then(() => {
                res.status(200).end();
            });

        } catch (error) {
            console.error('Excel download error:', error);
            res.status(500).json({ success: false, message: 'Error downloading report' });
        }
    },

    downloadPDF: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const startDay = new Date(startDate);
            const endDay = new Date(endDate);

            const start = new Date(startDay.setHours(23, 59, 59, 999));
            const end = new Date(endDay.setHours(23, 59, 59, 999));

            const orders = await Order.find({
                createdAt: { $gte: start, $lte: end },
                'items.order.status': { $nin: ['pending', 'cancelled'] },
                'payment.paymentStatus': { $nin: ['failed', 'cancelled'] }
            })
            .populate('userId', 'firstName lastName email')
            .populate('items.product', 'name')
            .lean();

            const doc = new PDFDocument();

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.pdf`);

            // Pipe the PDF to the response
            doc.pipe(res);

            // Add content
            doc.fontSize(16).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();

            // Create the table
            const table = {
                headers: ['Order ID', 'Date', 'Customer', 'Amount', 'Status'],
                rows: orders.map(order => [
                    order.orderCode,
                    new Date(order.createdAt).toLocaleDateString(),
                    `${order.userId?.firstName || ''} ${order.userId?.lastName || ''}`,
                    `₹${order.totalAmount.toFixed(2)}`,
                    order.items[0]?.order?.status || 'N/A'
                ])
            };

            // Add table to document
            doc.table(table, {
                prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
                prepareRow: () => doc.font('Helvetica').fontSize(10)
            });

            // Finalize PDF file
            doc.end();

        } catch (error) {
            console.error('PDF download error:', error);
            res.status(500).json({ success: false, message: 'Error downloading report' });
        }
    }
};

export default reportController; 