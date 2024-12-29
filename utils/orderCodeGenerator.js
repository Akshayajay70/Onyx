export function generateOrderCode(orderId, orderDate) {
    // Format date as DDMMYYYY
    const day = orderDate.getDate().toString().padStart(2, '0');
    const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
    const year = orderDate.getFullYear();
    const dateStr = `${day}${month}${year}`;
    
    // Get last 6 characters of the order ID
    const idSuffix = orderId.toString().slice(-6);
    
    // Combine to create 14-character code
    return `${dateStr}${idSuffix}`;
} 