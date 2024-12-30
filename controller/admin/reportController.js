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

            // Validate and parse dates
            const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(new Date().setDate(new Date().getDate() - 30));
            const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
            const today = new Date();

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid date range' 
                });
            }

            // Check if start date is in the future
            if (start > today) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Start date cannot be in the future' 
                });
            }

            // Check if end date is after start date
            if (end < start) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'End date must be after start date' 
                });
            }

            const orders = await Order.find({
                createdAt: {
                    $gte: start,
                    $lte: end
                },
                orderStatus: { $ne: 'cancelled' }
            }).populate('userId', 'firstName lastName email');

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add headers with more detailed columns
            worksheet.addRow([
                'Order ID',
                'Date',
                'Customer Name',
                'Items Count',
                'Original Price',
                'Coupon Code',
                'Coupon Discount',
                'Other Discount',
                'Final Amount',
                'Payment Method',
                'Status'
            ]);

            // Add data with original price calculation
            orders.forEach(order => {
                const originalPrice = order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0);

                worksheet.addRow([
                    order.orderCode.slice(-6),
                    order.createdAt.toLocaleDateString(),
                    order.userId ? `${order.userId.firstName || ''} ${order.userId.lastName || ''}` : 'N/A',
                    order.items.length,
                    originalPrice.toFixed(2),
                    order.couponCode || 'N/A',
                    (order.couponDiscount || 0).toFixed(2),
                    (order.discount || 0).toFixed(2),
                    order.totalAmount.toFixed(2),
                    order.paymentMethod,
                    order.orderStatus
                ]);
            });

            // Calculate totals with original prices
            const totals = orders.reduce((acc, order) => {
                const originalPrice = order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0);
                return {
                    totalOriginalSales: acc.totalOriginalSales + originalPrice,
                    totalDiscount: acc.totalDiscount + (order.couponDiscount || 0) + (order.discount || 0),
                    finalSales: acc.finalSales + order.totalAmount,
                    totalOrders: acc.totalOrders + 1
                };
            }, { totalOriginalSales: 0, totalDiscount: 0, finalSales: 0, totalOrders: 0 });

            // Add summary rows
            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.addRow(['Total Orders', totals.totalOrders]);
            worksheet.addRow(['Total Original Sales', totals.totalOriginalSales.toFixed(2)]);
            worksheet.addRow(['Total Discounts', totals.totalDiscount.toFixed(2)]);
            worksheet.addRow(['Net Revenue', totals.finalSales.toFixed(2)]);

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
                message: error.message || 'Error downloading report'
            });
        }
    },

    downloadPDF: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;

            // Validate and parse dates
            const start = startDate ? new Date(startDate + 'T23:59:59.999Z') : new Date(new Date().setDate(new Date().getDate() - 30));
            const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
            const today = new Date();

            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid date range' 
                });
            }

            // Check if start date is in the future
            if (start > today) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Start date cannot be in the future' 
                });
            }

            // Check if end date is after start date
            if (end < start) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'End date must be after start date' 
                });
            }

            const orders = await Order.find({
                createdAt: {
                    $gte: start,
                    $lte: end
                },
                orderStatus: { $ne: 'cancelled' }
            }).populate('userId', 'firstName lastName email');

            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${startDate}-${endDate}.pdf`);
            doc.pipe(res);

            // Add header
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Period: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();

            // Calculate totals with original prices
            const totals = orders.reduce((acc, order) => {
                const originalPrice = order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0);
                return {
                    totalOriginalSales: acc.totalOriginalSales + originalPrice,
                    totalDiscount: acc.totalDiscount + (order.couponDiscount || 0) + (order.discount || 0),
                    finalSales: acc.finalSales + order.totalAmount,
                    totalOrders: acc.totalOrders + 1
                };
            }, { totalOriginalSales: 0, totalDiscount: 0, finalSales: 0, totalOrders: 0 });

            // Add summary section
            doc.fontSize(14).text('Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12)
               .text(`Total Orders: ${totals.totalOrders}`)
               .text(`Original Sales: ₹${totals.totalOriginalSales.toFixed(2)}`)
               .text(`Total Discounts: ₹${totals.totalDiscount.toFixed(2)}`)
               .text(`Net Revenue: ₹${totals.finalSales.toFixed(2)}`);
            doc.moveDown();

            // Add orders table
            doc.fontSize(14).text('Order Details', { underline: true });
            doc.moveDown();

            // Table headers
            const tableTop = doc.y;
            const columns = {
                orderID: { x: 50, width: 60 },
                date: { x: 110, width: 70 },
                customer: { x: 180, width: 90 },
                original: { x: 270, width: 70 },
                discount: { x: 340, width: 70 },
                final: { x: 410, width: 70 },
                payment: { x: 480, width: 70 }
            };

            // Draw headers
            doc.fontSize(10)
               .text('Order ID', columns.orderID.x, tableTop)
               .text('Date', columns.date.x, tableTop)
               .text('Customer', columns.customer.x, tableTop)
               .text('Original', columns.original.x, tableTop)
               .text('Discount', columns.discount.x, tableTop)
               .text('Final', columns.final.x, tableTop)
               .text('Payment', columns.payment.x, tableTop);

            doc.moveDown();
            let tableY = doc.y;

            // Draw rows
            orders.forEach((order, i) => {
                if (tableY > 700) {
                    doc.addPage();
                    tableY = 50;
                }

                const row = tableY + (i * 20);
                const originalPrice = order.items.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0);
                const totalDiscount = (order.couponDiscount || 0) + (order.discount || 0);

                doc.fontSize(9)
                   .text(order.orderCode.slice(-6), columns.orderID.x, row)
                   .text(order.createdAt.toLocaleDateString(), columns.date.x, row)
                   .text(order.userId ? `${order.userId.firstName || ''} ${order.userId.lastName || ''}` : 'N/A', columns.customer.x, row)
                   .text(`₹${originalPrice.toFixed(2)}`, columns.original.x, row)
                   .text(`₹${totalDiscount.toFixed(2)}`, columns.discount.x, row)
                   .text(`₹${order.totalAmount.toFixed(2)}`, columns.final.x, row)
                   .text(order.paymentMethod, columns.payment.x, row);

                tableY = row;
            });

            // Add footer
            doc.fontSize(10).text(
                `Report generated on ${new Date().toLocaleString()}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );

            doc.end();

        } catch (error) {
            console.error('PDF download error:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Error downloading report'
            });
        }
    }
};

export default reportController; 