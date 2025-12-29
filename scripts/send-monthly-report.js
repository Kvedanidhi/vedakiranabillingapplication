const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sendMonthlyReport() {
  const now = new Date();
  // Get first and last day of the PREVIOUS month
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const monthName = new Date(now.getFullYear(), now.getMonth() - 1).toLocaleString('default', { month: 'long' });

  // 1. Fetch all sales for the month
  const { data: sales } = await supabase
    .from('sales')
    .select('items, total, created_at')
    .gte('created_at', firstDay)
    .lte('created_at', lastDay);

  if (!sales || sales.length === 0) return console.log("No sales to report for the month.");

  // 2. Process data: Top Selling Items
  const itemSummary = {};
  let totalMonthlyRevenue = 0;

  sales.forEach(sale => {
    totalMonthlyRevenue += sale.total;
    sale.items.forEach(item => {
      if (!itemSummary[item.product_id]) {
        itemSummary[item.product_id] = { name: item.name, qty: 0, revenue: 0 };
      }
      itemSummary[item.product_id].qty += item.quantity;
      itemSummary[item.product_id].revenue += (item.price * item.quantity);
    });
  });

  // Sort to find top 5 items
  const topItems = Object.values(itemSummary)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 3. Generate CSV for full month transactions
  let csvContent = "Date,Customer,Total Amount\n";
  sales.forEach(s => {
    csvContent += `${new Date(s.created_at).toLocaleDateString()},${(s.customer_name || 'Cash').replace(/,/g, "")},${s.total}\n`;
  });

  // 4. Setup Email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: `"Veda Kirana Reports" <${process.env.EMAIL_USER}>`,
    to: 'email1@gmail.com, email2@gmail.com', // Update your emails here
    subject: `Monthly Business Analysis: ${monthName} ${now.getFullYear()}`,
    html: `
      <div style="font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; max-width: 600px; margin: auto;">
        <h2 style="color: #1e293b; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">${monthName} Sales Report</h2>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #64748b;">Total Monthly Revenue</p>
            <h1 style="margin: 5px 0; color: #4f46e5;">₹${totalMonthlyRevenue.toFixed(2)}</h1>
            <p style="margin: 0; color: #64748b;">Total Transactions: <strong>${sales.length}</strong></p>
        </div>

        <h3 style="color: #334155;">🚀 Top 5 Best Sellers</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${topItems.map(item => `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.name}</td>
              <td style="text-align: right; font-weight: bold;">${item.qty} units</td>
            </tr>`).join('')}
        </table>

        <p style="margin-top: 25px; font-size: 13px; color: #94a3b8;">
          Note: A detailed spreadsheet of every bill from last month is attached.
        </p>
      </div>`,
    attachments: [{ filename: `${monthName}_Full_Sales_Report.csv`, content: csvContent }]
  };

  await transporter.sendMail(mailOptions);
}
sendMonthlyReport();
