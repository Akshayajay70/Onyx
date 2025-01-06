import User from '../model/userModel.js';
import { config } from 'dotenv';
import Order from '../model/orderModel.js';
import { startOfYear, endOfYear, eachMonthOfInterval, format } from 'date-fns';

config()

const getAdmin = (req, res) => {
    res.render('admin/login');
}

const postAdmin = async (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true; // Set admin session
        res.redirect('/admin/dashboard'); // Redirect to dashboard route instead
    } else {
        res.render('admin/login');
    }
}

const getLogout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
}

const getDashboard = async (req, res) => {
    try {
        const timeFrame = req.query.timeFrame || 'yearly'; // Default to yearly view
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
            'order.status': 'delivered'
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

        res.render('admin/dashboard', {
            chartData: JSON.stringify(chartData),
            timeFrame,
            totalRevenue: yearlyRevenue[0]?.total || 0,
            totalOrders,
            completedOrders,
            growthPercentage
        });

    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const timeFrame = req.query.timeFrame || 'yearly';
        // Set current date to Indian time (UTC+5:30)
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
                    'order.status': 'delivered'
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

                return res.json({
                    chartData,
                    totalRevenue,
                    totalOrders,
                    completedOrders,
                    growthPercentage
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
            'order.status': 'delivered'
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

// Get the list of all users
const getUserList = async (req, res) => {
    try {
        const userList = await User.find(); // Fetch all users from the database
        res.render('admin/userList', { userList }); // Render a view to display the users
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const getToggle = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.blocked = !user.blocked;
        await user.save();

        // Return JSON response for API calls
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: `User successfully ${user.blocked ? 'blocked' : 'unblocked'}`
            });
        }

        // Fallback to redirect for regular form submissions
        res.redirect('/admin/userList');
    } catch (err) {
        console.error(err);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Server Error' });
        }
        res.status(500).send('Server Error');
    }
};

export default { getAdmin, postAdmin, getLogout, getDashboard, getUserList, getToggle, getDashboardData }