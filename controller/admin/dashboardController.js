import Order from '../../model/orderModel.js';
import { startOfYear, endOfYear, eachMonthOfInterval, format } from 'date-fns';
import Category from '../../model/categoryModel.js';

const getDashboard = async (req, res) => {
    try {
        const timeFrame = req.query.timeFrame || 'yearly'; // Default to yearly view
        const productSort = req.query.productSort || 'units';
        const categorySort = req.query.categorySort || 'units';
        const currentDate = new Date();
        let startDate, endDate, dateFormat, groupBy;

        // Set date ranges based on timeFrame
        switch (timeFrame) {
            case 'daily':
                startDate = new Date(currentDate.setHours(0, 0, 0, 0));
                endDate = new Date(currentDate.setHours(23, 59, 59, 999));
                dateFormat = 'HH:mm'; // Hours format
                groupBy = { $hour: '$orderDate' };
                break;
            case 'weekly':
                startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
                endDate = new Date();
                dateFormat = 'EEE'; // Day name format
                groupBy = { $dayOfWeek: '$orderDate' };
                break;
            case 'monthly':
                startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                dateFormat = 'dd'; // Day of month format
                groupBy = { $dayOfMonth: '$orderDate' };
                break;
            default: // yearly
                startDate = startOfYear(new Date(currentDate.getFullYear(), 0));
                endDate = endOfYear(new Date(currentDate.getFullYear(), 0));
                dateFormat = 'MMM'; // Month name format
                groupBy = { $month: '$orderDate' };
        }

        // Get revenue data based on timeFrame
        const revenueData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    'payment.paymentStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: groupBy,
                    totalRevenue: { $sum: '$totalAmount' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Format chart data based on timeFrame
        let chartData;
        if (timeFrame === 'daily') {
            // 24-hour format
            chartData = Array.from({ length: 24 }, (_, hour) => {
                const revenue = revenueData.find(d => d._id === hour);
                return {
                    time: `${hour}:00`,
                    revenue: revenue ? revenue.totalRevenue : 0
                };
            });
        } else if (timeFrame === 'weekly') {
            // Last 7 days
            chartData = Array.from({ length: 7 }, (_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const revenue = revenueData.find(d => d._id === ((date.getDay() + 1) % 7 + 1));
                return {
                    time: format(date, 'EEE'),
                    revenue: revenue ? revenue.totalRevenue : 0
                };
            });
        } else if (timeFrame === 'monthly') {
            // Days in current month
            const daysInMonth = endDate.getDate();
            chartData = Array.from({ length: daysInMonth }, (_, i) => {
                const revenue = revenueData.find(d => d._id === (i + 1));
                return {
                    time: `${i + 1}`,
                    revenue: revenue ? revenue.totalRevenue : 0
                };
            });
        } else {
            // Months in year
            chartData = Array.from({ length: 12 }, (_, i) => {
                const revenue = revenueData.find(d => d._id === (i + 1));
                return {
                    time: format(new Date(currentDate.getFullYear(), i), 'MMM'),
                    revenue: revenue ? revenue.totalRevenue : 0
                };
            });
        }

        // Get total revenue for the year
        const yearlyRevenue = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    'payment.paymentStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        // Get total orders count
        const totalOrders = await Order.countDocuments({
            orderDate: { $gte: startDate, $lte: endDate }
        });

        // Get completed orders count
        const completedOrders = await Order.countDocuments({
            orderDate: { $gte: startDate, $lte: endDate },
            'items.order.status': 'delivered'
        });

        // Calculate monthly growth
        const previousMonth = new Date();
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        
        const currentMonthRevenue = await Order.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: new Date(currentDate.getFullYear(), new Date().getMonth(), 1),
                        $lte: new Date()
                    },
                    'payment.paymentStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        const previousMonthRevenue = await Order.aggregate([
            {
                $match: {
                    orderDate: { 
                        $gte: new Date(currentDate.getFullYear(), previousMonth.getMonth(), 1),
                        $lte: new Date(currentDate.getFullYear(), previousMonth.getMonth() + 1, 0)
                    },
                    'payment.paymentStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        // Calculate growth percentage
        const currentMonthTotal = currentMonthRevenue[0]?.total || 0;
        const previousMonthTotal = previousMonthRevenue[0]?.total || 0;
        const growthPercentage = previousMonthTotal === 0 ? 100 :
            Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100);

        // Get top 3 selling products
        const topProducts = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    'payment.paymentStatus': 'completed',
                    'items.order.status': { $ne: 'cancelled' }
                }
            },
            { $unwind: '$items' },
            {
                $match: {
                    'items.order.status': { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: '$items.product',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.subtotal' }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $project: {
                    productName: '$productDetails.productName',
                    brand: '$productDetails.brand',
                    totalQuantity: 1,
                    totalRevenue: 1,
                    imageUrl: { $arrayElemAt: ['$productDetails.imageUrl', 0] }
                }
            },
            { 
                $sort: productSort === 'revenue' ? 
                    { totalRevenue: -1 } : 
                    { totalQuantity: -1 } 
            },
            { $limit: 3 }
        ]);

        // Get top 3 selling categories with dynamic sorting
        const topCategories = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lte: endDate },
                    'payment.paymentStatus': 'completed',
                    'items.order.status': { $ne: 'cancelled' }
                }
            },
            { $unwind: '$items' },
            {
                $match: {
                    'items.order.status': { $ne: 'cancelled' }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.categoriesId',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: '$categoryDetails' },
            {
                $group: {
                    _id: '$categoryDetails._id',
                    categoryName: { $first: '$categoryDetails.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    // Calculate revenue using the actual price from items
                    totalRevenue: { 
                        $sum: { 
                            $multiply: [
                                { $subtract: ['$items.price', { $ifNull: ['$items.discountedPrice', 0] }] },
                                '$items.quantity'
                            ] 
                        } 
                    }
                }
            },
            {
                $match: {
                    // Ensure we only get active categories
                    '_id': { 
                        $in: await Category.find({ isActive: true }).distinct('_id') 
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    categoryName: 1,
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { 
                $sort: categorySort === 'revenue' ? 
                    { totalRevenue: -1 } :  // Sort by total revenue if revenue is selected
                    { totalQuantity: -1 }   // Sort by total quantity if units is selected
            },
            { $limit: 3 }
        ]);

        res.render('admin/dashboard', {
            chartData: JSON.stringify(chartData),
            timeFrame,
            totalRevenue: yearlyRevenue[0]?.total || 0,
            totalOrders,
            completedOrders,
            growthPercentage,
            topProducts,
            topCategories,
            productSort,
            categorySort
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const timeFrame = req.query.timeFrame || 'yearly';
        const productSort = req.query.productSort || 'units';
        const categorySort = req.query.categorySort || 'units';
        const currentDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        let startDate, endDate, groupBy, chartData;

        // Set date ranges based on timeFrame
        switch (timeFrame) {
            case 'daily':
                startDate = new Date(currentDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(currentDate);
                endDate.setHours(23, 59, 59, 999);
                
                // Get hourly revenue data with IST adjustment
                const dailyData = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed'
                        }
                    },
                    {
                        $project: {
                            // Convert to IST by adding 5 hours and 30 minutes
                            hour: {
                                $hour: {
                                    $add: ['$orderDate', 5.5 * 60 * 60 * 1000]
                                }
                            },
                            totalAmount: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$hour',
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                // Generate 24-hour data in IST
                chartData = Array.from({ length: 24 }, (_, hour) => {
                    const hourData = dailyData.find(d => d._id === hour) || { totalRevenue: 0 };
                    return {
                        time: `${hour.toString().padStart(2, '0')}:00`,
                        revenue: hourData.totalRevenue
                    };
                });
                break;

            case 'weekly':
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(currentDate);
                endDate.setHours(23, 59, 59, 999);

                // Get daily revenue data for the week in IST
                const weeklyData = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed'
                        }
                    },
                    {
                        $project: {
                            date: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: {
                                        $add: ['$orderDate', 5.5 * 60 * 60 * 1000]
                                    }
                                }
                            },
                            totalAmount: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$date',
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                // Generate data for each day of the week in IST
                chartData = [];
                for (let i = 0; i < 7; i++) {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayData = weeklyData.find(d => d._id === dateStr) || { totalRevenue: 0 };
                    chartData.push({
                        time: format(date, 'EEE'),
                        revenue: dayData.totalRevenue
                    });
                }
                break;

            case 'monthly':
                startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

                // Get daily revenue data for the month in IST
                const monthlyData = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed'
                        }
                    },
                    {
                        $project: {
                            day: {
                                $dayOfMonth: {
                                    $add: ['$orderDate', 5.5 * 60 * 60 * 1000]
                                }
                            },
                            totalAmount: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$day',
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                // Generate data for each day of the month
                const daysInMonth = endDate.getDate();
                chartData = Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const dayData = monthlyData.find(d => d._id === day) || { totalRevenue: 0 };
                    return {
                        time: day.toString(),
                        revenue: dayData.totalRevenue
                    };
                });
                break;

            case 'yearly':
                startDate = new Date(currentDate.getFullYear(), 0, 1);
                endDate = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);

                // Get monthly revenue data for the year in IST
                const yearlyData = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed'
                        }
                    },
                    {
                        $project: {
                            month: {
                                $month: {
                                    $add: ['$orderDate', 5.5 * 60 * 60 * 1000]
                                }
                            },
                            totalAmount: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$month',
                            totalRevenue: { $sum: '$totalAmount' }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                // Generate data for each month
                chartData = Array.from({ length: 12 }, (_, index) => {
                    const month = index + 1;
                    const monthData = yearlyData.find(d => d._id === month) || { totalRevenue: 0 };
                    return {
                        time: format(new Date(currentDate.getFullYear(), index), 'MMM'),
                        revenue: monthData.totalRevenue
                    };
                });
                break;

            case 'custom':
                // Parse custom date range
                startDate = new Date(req.query.startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999);
                
                // Calculate date difference
                const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

                // Get revenue data first
                let revenueData;
                
                if (daysDiff <= 1) {
                    // Single day - show hourly data
                    groupBy = { $hour: '$orderDate' };
                    revenueData = await Order.aggregate([
                        {
                            $match: {
                                orderDate: { $gte: startDate, $lte: endDate },
                                'payment.paymentStatus': 'completed'
                            }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                totalRevenue: { $sum: '$totalAmount' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]);

                    chartData = Array.from({ length: 24 }, (_, hour) => {
                        const revenue = revenueData.find(d => d._id === hour) || { totalRevenue: 0 };
                        return {
                            time: `${hour.toString().padStart(2, '0')}:00`,
                            revenue: revenue.totalRevenue
                        };
                    });
                } else if (daysDiff <= 31) {
                    // Up to a month - show daily data
                    groupBy = { 
                        $dateToString: { 
                            format: '%Y-%m-%d', 
                            date: '$orderDate' 
                        } 
                    };
                    revenueData = await Order.aggregate([
                        {
                            $match: {
                                orderDate: { $gte: startDate, $lte: endDate },
                                'payment.paymentStatus': 'completed'
                            }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                totalRevenue: { $sum: '$totalAmount' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]);

                    // Generate dates array
                    chartData = [];
                    let currentDate = new Date(startDate);
                    while (currentDate <= endDate) {
                        const dateStr = currentDate.toISOString().split('T')[0];
                        const revenue = revenueData.find(d => d._id === dateStr) || { totalRevenue: 0 };
                        chartData.push({
                            time: format(currentDate, 'MMM dd'),
                            revenue: revenue.totalRevenue
                        });
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                } else {
                    // More than a month - show monthly data
                    groupBy = { 
                        $dateToString: { 
                            format: '%Y-%m', 
                            date: '$orderDate' 
                        } 
                    };
                    revenueData = await Order.aggregate([
                        {
                            $match: {
                                orderDate: { $gte: startDate, $lte: endDate },
                                'payment.paymentStatus': 'completed'
                            }
                        },
                        {
                            $group: {
                                _id: groupBy,
                                totalRevenue: { $sum: '$totalAmount' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]);

                    // Generate months array
                    const months = eachMonthOfInterval({ start: startDate, end: endDate });
                    chartData = months.map(date => {
                        const monthStr = format(date, 'yyyy-MM');
                        const revenue = revenueData.find(d => d._id === monthStr) || { totalRevenue: 0 };
                        return {
                            time: format(date, 'MMM yyyy'),
                            revenue: revenue.totalRevenue
                        };
                    });
                }

                // Calculate total revenue
                const totalRevenue = revenueData.reduce((sum, item) => sum + item.totalRevenue, 0);

                // Get orders count for custom range
                const totalOrders = await Order.countDocuments({
                    orderDate: { $gte: startDate, $lte: endDate }
                });

                const completedOrders = await Order.countDocuments({
                    orderDate: { $gte: startDate, $lte: endDate },
                    'items.order.status': 'delivered'
                });

                // Calculate growth percentage for custom range
                const previousPeriodStart = new Date(startDate);
                const previousPeriodEnd = new Date(endDate);
                const periodDuration = endDate - startDate;
                previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDuration);
                previousPeriodEnd.setTime(previousPeriodEnd.getTime() - periodDuration);

                const previousPeriodRevenue = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
                            'payment.paymentStatus': 'completed'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$totalAmount' }
                        }
                    }
                ]);

                const previousTotal = previousPeriodRevenue[0]?.total || 0;
                const growthPercentage = previousTotal === 0 ? 100 :
                    Math.round(((totalRevenue - previousTotal) / previousTotal) * 100);

                // Get top products with dynamic sorting
                const topProducts = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed',
                            'items.order.status': { $ne: 'cancelled' }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.order.status': { $ne: 'cancelled' }
                        }
                    },
                    {
                        $group: {
                            _id: '$items.product',
                            totalQuantity: { $sum: '$items.quantity' },
                            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'productDetails'
                        }
                    },
                    { $unwind: '$productDetails' },
                    {
                        $project: {
                            productName: '$productDetails.productName',
                            brand: '$productDetails.brand',
                            totalQuantity: 1,
                            totalRevenue: 1,
                            imageUrl: { $arrayElemAt: ['$productDetails.imageUrl', 0] }
                        }
                    },
                    { 
                        $sort: productSort === 'revenue' ? 
                            { totalRevenue: -1 } : 
                            { totalQuantity: -1 } 
                    },
                    { $limit: 3 }
                ]);

                // Get top categories with proper sorting
                const topCategories = await Order.aggregate([
                    {
                        $match: {
                            orderDate: { $gte: startDate, $lte: endDate },
                            'payment.paymentStatus': 'completed',
                            'items.order.status': { $ne: 'cancelled' }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.order.status': { $ne: 'cancelled' }
                        }
                    },
                    {
                        $lookup: {
                            from: 'products',
                            localField: 'items.product',
                            foreignField: '_id',
                            as: 'productDetails'
                        }
                    },
                    { $unwind: '$productDetails' },
                    {
                        $lookup: {
                            from: 'categories',
                            localField: 'productDetails.categoriesId',
                            foreignField: '_id',
                            as: 'categoryDetails'
                        }
                    },
                    { $unwind: '$categoryDetails' },
                    {
                        $group: {
                            _id: '$categoryDetails._id',
                            categoryName: { $first: '$categoryDetails.name' },
                            totalQuantity: { $sum: '$items.quantity' },
                            totalRevenue: { 
                                $sum: { 
                                    $multiply: ['$items.price', '$items.quantity']
                                } 
                            }
                        }
                    },
                    {
                        $match: {
                            '_id': { 
                                $in: await Category.find({ isActive: true }).distinct('_id') 
                            }
                        }
                    },
                    {
                        $sort: categorySort === 'revenue' ? 
                            { totalRevenue: -1 } : 
                            { totalQuantity: -1 }
                    },
                    { $limit: 3 }
                ]);

                return res.json({
                    chartData,
                    totalRevenue,
                    totalOrders,
                    completedOrders,
                    growthPercentage,
                    topProducts,
                    topCategories
                });
        }

        // Calculate total revenue for the period
        const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);

        // Get orders count
        const totalOrders = await Order.countDocuments({
            orderDate: { $gte: startDate, $lte: endDate }
        });

        const completedOrders = await Order.countDocuments({
            orderDate: { $gte: startDate, $lte: endDate },
            'items.order.status': 'delivered'
        });

        // Calculate growth percentage
        const previousPeriodStart = new Date(startDate);
        const previousPeriodEnd = new Date(endDate);
        const periodDuration = endDate - startDate;
        previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDuration);
        previousPeriodEnd.setTime(previousPeriodEnd.getTime() - periodDuration);

        const previousPeriodRevenue = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
                    'payment.paymentStatus': 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);

        const previousTotal = previousPeriodRevenue[0]?.total || 0;
        const growthPercentage = previousTotal === 0 ? 100 :
            Math.round(((totalRevenue - previousTotal) / previousTotal) * 100);

        return res.json({
            chartData,
            totalRevenue,
            totalOrders,
            completedOrders,
            growthPercentage
        });

    } catch (error) {
        console.error('Dashboard Data Error:', error);
        res.status(500).json({ error: 'Error loading dashboard data' });
    }
};

export default { getDashboard, getDashboardData }