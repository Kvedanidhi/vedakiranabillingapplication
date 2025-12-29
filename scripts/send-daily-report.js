const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sendVyaparStyleReport() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch Today's Sales
  const { data: sales } = await supabase
    .from('sales')
    .select('items, total')
    .gte('created_at', `${today}T00:00:00.000Z`);

  // 2. Fetch ALL 600+ Items for the Spreadsheet
  const { data: allProducts } = await supabase
    .from('products')
    .select('name, barcode, category, stock_batches(quantity_remaining)');

  // 3. Prepare the Email Summary Table (Only items sold today)
  const itemSummary = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      if (!itemSummary[item.product_id]) {
        itemSummary[item.product_id] = { name: item.name, qtySold: 0, revenue: 0 };
      }
      itemSummary[item.product_id].qtySold += item.quantity;
      itemSummary[item.product_id].revenue += (item.price * item.quantity);
    });
  });

  let summaryRows = '';
  for (const id in itemSummary) {
    const p = itemSummary[id];
    summaryRows += `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${p.name}</td><td style="text-align:center;">${p.qtySold}</td><td style="text-align:right;">₹${p.revenue.toFixed(2)}</td></tr>`;
  }

  // 4. Generate the FULL CSV Spreadsheet Content (All 600+ items)
  let csvContent = "Product Name,Barcode,Category,Current Stock\n";
  allProducts.forEach(p => {
    const totalStock = p.stock_batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
    // Remove commas from names to avoid breaking the CSV format
    const safeName = p.name.replace(/,/g, ""); 
    csvContent += `${safeName},${p.barcode || 'N/A'},${p.category},${totalStock}\n`;
  });

  // 5. Setup Email Transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: `"Veda Kirana POS" <${process.env.EMAIL_USER}>`,
    to: 'vedakirana@gmail.com', // Replace with your actual email(s)
    subject: `Daily Business Report - ${today}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #4F46E5;">Daily Sales Summary</h2>
        <p>Today's total revenue: <strong>₹${sales.reduce((s, x) => s + x.total, 0).toFixed(2)}</strong></p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="padding:8px; text-align:left;">Item</th>
            <th>Sold</th>
            <th style="text-align:right;">Revenue</th>
          </tr>
          ${summaryRows || '<tr><td colspan="3" style="padding:20px; text-align:center;">No sales today.</td></tr>'}
        </table>
        <p style="margin-top:20px; font-size: 13px; color: #666;">
          Note: A full spreadsheet of all 600+ inventory items is attached to this email.
        </p>
      </div>`,
    attachments: [
      {
        filename: `Veda_Kirana_Full_Inventory_${today}.csv`,
        content: csvContent
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log("Professional report sent!");
}

sendVyaparStyleReport();
