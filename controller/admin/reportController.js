import Order from '../../model/orderModel.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';

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

            // Fetch orders with date range and populate user data
            const orders = await Order.find(query)
                .populate('userId', 'firstName lastName email')
                .sort({ createdAt: -1 });

            // Calculate metrics using discounted prices
            const metrics = {
                totalOrders: orders.length,
                totalSales: orders.reduce((sum, order) => sum + order.totalAmount, 0),
                totalDiscount: orders.reduce((sum, order) => {
                    const couponDiscount = order.couponDiscount || 0;
                    const otherDiscounts = order.discount || 0;
                    return sum + couponDiscount + otherDiscounts;
                }, 0),
                netRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0)
            };

            // Calculate average order value from net revenue
            metrics.averageOrderValue = orders.length ? metrics.netRevenue / orders.length : 0;

            // Group orders by date with discounted prices
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
                acc[date].discount += (order.couponDiscount || 0) + (order.discount || 0);
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
            const start = new Date(startDate);
            const end = new Date(endDate);

            const orders = await Order.find({
                createdAt: { $gte: start, $lte: end },
                'order.status': { $ne: 'cancelled' }
            }).populate('userId', 'firstName lastName email');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add title and date range
            worksheet.mergeCells('A1:H1');
            worksheet.getCell('A1').value = 'Sales Report';
            worksheet.getCell('A1').font = { size: 16, bold: true };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A2:H2');
            worksheet.getCell('A2').value = `Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            // Add headers
            worksheet.addRow(['']);  // Empty row for spacing
            const headers = [
                'Order ID',
                'Date',
                'Customer',
                'Items',
                'Original Amount',
                'Discount',
                'Final Amount',
                'Payment Status'
            ];

            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true };
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF333333' }
                };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            });

            // Add data
            orders.forEach(order => {
                const itemsList = order.items.map(item => 
                    `${item.quantity}x ${item.product.productName}`
                ).join('\n');

                const originalAmount = order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0);

                worksheet.addRow([
                    order.orderCode,
                    new Date(order.orderDate).toLocaleDateString(),
                    `${order.userId.firstName} ${order.userId.lastName}`,
                    itemsList,
                    originalAmount.toFixed(2),
                    (order.coupon?.discount || 0).toFixed(2),
                    order.totalAmount.toFixed(2),
                    order.payment.paymentStatus
                ]);
            });

            // Add totals
            worksheet.addRow(['']);  // Empty row
            const totals = orders.reduce((acc, order) => ({
                originalAmount: acc.originalAmount + order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0),
                discount: acc.discount + (order.coupon?.discount || 0),
                finalAmount: acc.finalAmount + order.totalAmount
            }), { originalAmount: 0, discount: 0, finalAmount: 0 });

            const totalRow = worksheet.addRow([
                'TOTALS',
                '',
                '',
                '',
                totals.originalAmount.toFixed(2),
                totals.discount.toFixed(2),
                totals.finalAmount.toFixed(2),
                ''
            ]);
            totalRow.font = { bold: true };

            // Style the worksheet
            worksheet.columns.forEach(column => {
                column.width = 15;
                column.alignment = { vertical: 'middle', horizontal: 'left' };
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.xlsx`);

            await workbook.xlsx.write(res);
        } catch (error) {
            console.error('Excel download error:', error);
            res.status(500).json({ success: false, message: 'Error downloading report' });
        }
    },

    downloadPDF: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const start = new Date(startDate);
            const end = new Date(endDate);

            const orders = await Order.find({
                createdAt: { $gte: start, $lte: end },
                'order.status': { $ne: 'cancelled' }
            }).populate('userId', 'firstName lastName email');

            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.pdf`);

            // Pipe the PDF to the response
            doc.pipe(res);

            // Add header with logo (if you have one)
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();

            // Add summary section
            const totals = orders.reduce((acc, order) => ({
                totalOrders: acc.totalOrders + 1,
                originalAmount: acc.originalAmount + order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0),
                discount: acc.discount + (order.coupon?.discount || 0),
                finalAmount: acc.finalAmount + order.totalAmount
            }), { totalOrders: 0, originalAmount: 0, discount: 0, finalAmount: 0 });

            // Create summary table
            const summaryTable = {
                title: "Summary",
                headers: ["Metric", "Value"],
                rows: [
                    ["Total Orders", totals.totalOrders.toString()],
                    ["Original Amount", `₹${totals.originalAmount.toFixed(2)}`],
                    ["Total Discount", `₹${totals.discount.toFixed(2)}`],
                    ["Net Revenue", `₹${totals.finalAmount.toFixed(2)}`]
                ]
            };

            await doc.table(summaryTable, {
                prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
                prepareRow: () => doc.font('Helvetica').fontSize(10)
            });

            doc.moveDown();

            // Create orders table
            const tableData = {
                title: "Order Details",
                headers: ["Order ID", "Date", "Customer", "Amount", "Status"],
                rows: orders.map(order => [
                    order.orderCode,
                    new Date(order.orderDate).toLocaleDateString(),
                    `${order.userId.firstName} ${order.userId.lastName}`,
                    `₹${order.totalAmount.toFixed(2)}`,
                    order.order.status
                ])
            };

            await doc.table(tableData, {
                prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
                prepareRow: () => doc.font('Helvetica').fontSize(10),
                width: 500
            });

            // Add footer
            doc.moveDown();
            doc.fontSize(8).text(
                `Generated on ${new Date().toLocaleString()}`,
                { align: 'center', color: 'grey' }
            );

            doc.end();

        } catch (error) {
            console.error('PDF download error:', error);
            res.status(500).json({ success: false, message: 'Error downloading report' });
        }
    }
};

export default reportController; 