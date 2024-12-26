import Order from '../../model/orderModel.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const reportController = {
    getSalesReport: async (req, res) => {
        try {
            const { startDate, endDate, period } = req.query;
            let query = { orderStatus: { $ne: 'cancelled' } };
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
                dateRange.start = new Date(startDate);
                dateRange.end = new Date(endDate);
            }

            if (dateRange.start && dateRange.end) {
                query.createdAt = {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                };
            }

            // Fetch orders with date range
            const orders = await Order.find(query)
                .populate('userId', 'name email')
                .sort({ createdAt: -1 });

            // Calculate metrics
            const metrics = {
                totalOrders: orders.length,
                totalSales: orders.reduce((sum, order) => sum + order.totalAmount, 0),
                totalDiscount: orders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0),
                averageOrderValue: orders.length ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0
            };

            // Group orders by date
            const dailyData = orders.reduce((acc, order) => {
                const date = order.createdAt.toISOString().split('T')[0];
                if (!acc[date]) {
                    acc[date] = {
                        orders: 0,
                        sales: 0,
                        discount: 0
                    };
                }
                acc[date].orders++;
                acc[date].sales += order.totalAmount;
                acc[date].discount += order.couponDiscount || 0;
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

            // Validate and parse dates
            const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(new Date().setDate(new Date().getDate() - 30));
            const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date range');
            }

            const orders = await Order.find({
                createdAt: {
                    $gte: start,
                    $lte: end
                },
                orderStatus: { $ne: 'cancelled' }
            }).populate('userId', 'name email');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add headers
            worksheet.addRow([
                'Order ID',
                'Date',
                'Customer',
                'Items',
                'Total Amount',
                'Payment Method',
                'Status'
            ]);

            // Add data
            orders.forEach(order => {
                worksheet.addRow([
                    order._id.toString(),
                    order.createdAt.toLocaleDateString(),
                    order.userId.name,
                    order.items.length,
                    order.totalAmount,
                    order.paymentMethod,
                    order.orderStatus
                ]);
            });

            // Style the worksheet
            worksheet.getRow(1).font = { bold: true };
            worksheet.columns.forEach(column => {
                column.width = 15;
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Excel download error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error downloading report: ' + error.message 
            });
        }
    },

    downloadPDF: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            // Validate and parse dates
            const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(new Date().setDate(new Date().getDate() - 30));
            const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Invalid date range');
            }

            const orders = await Order.find({
                createdAt: {
                    $gte: start,
                    $lte: end
                },
                orderStatus: { $ne: 'cancelled' }
            }).populate('userId', 'name email');

            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.pdf`);
            doc.pipe(res);

            // Add title
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();

            // Add date range
            doc.fontSize(12).text(`Period: ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();

            // Add summary
            const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
            doc.fontSize(14).text('Summary', { underline: true });
            doc.fontSize(12).text(`Total Orders: ${orders.length}`);
            doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`);
            doc.moveDown();

            // Add orders table
            doc.fontSize(14).text('Order Details', { underline: true });
            doc.moveDown();

            orders.forEach(order => {
                doc.fontSize(12).text(`Order ID: ${order._id}`);
                doc.text(`Customer: ${order.userId.name}`);
                doc.text(`Amount: ₹${order.totalAmount}`);
                doc.text(`Status: ${order.orderStatus}`);
                doc.moveDown();
            });

            doc.end();

        } catch (error) {
            console.error('PDF download error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error downloading report: ' + error.message 
            });
        }
    }
};

export default reportController; 