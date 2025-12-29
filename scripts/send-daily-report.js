const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// These are pulled from your GitHub Secrets
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sendVyaparStyleReport() {
  const today = new Date().toISOString().split('T')[0];

  console.log(`Starting report for: ${today}`);

  // 1. Fetch Today's Sales
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('items, total')
    .gte('created_at', `${today}T00:00:00.000Z`);

  if (salesError) console.error("Error fetching sales:", salesError);

  // 2. Fetch ALL Products (Ensure the join name matches your DB: stock_batches)
  const { data: allProducts, error: prodError } = await supabase
    .from('products')
    .select('name, barcode, category, stock_batches(quantity_remaining)');

  if (prodError) console.error("Error fetching products:", prodError);

  // 3. Check if we actually got data
  if (!allProducts || allProducts.length === 0) {
    console.log("CRITICAL: No products found in database. Check table permissions or API keys.");
    return;
  }

  console.log(`Found ${allProducts.length} items in inventory.`);

  // 4. Prepare Email Summary (Sold Today)
  const itemSummary = {};
  (sales || []).forEach(sale => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        if (!itemSummary[item.product_id]) {
          itemSummary[item.product_id] = { name: item.name, qtySold: 0, revenue: 0 };
        }
        itemSummary[item.product_id].qtySold += item.quantity;
        itemSummary[item.product_id].revenue += (item.price * item.quantity);
      });
    }
  });

  let summaryRows = '';
  for (const id in itemSummary) {
    const p = itemSummary[id];
    summaryRows += `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${p.name}</td><td style="text-align:center;">${p.qtySold}</td><td style="text-align:right;">₹${p.revenue.toFixed(2)}</td></tr>`;
  }

  // 5. Generate FULL CSV (Fixing the reduction logic)
  let csvContent = "Product Name,Barcode,Category,Current Stock\n";
  allProducts.forEach(p => {
    // Calculate total stock across all active batches
    const batches = p.stock_batches || [];
    const totalStock = batches.reduce((sum, b) => sum + (b.quantity_remaining || 0), 0);
    
    const safeName = p.name.replace(/,/g, ""); 
    csvContent += `${safeName},${p.barcode || 'N/A'},${p.category || 'General'},${totalStock}\n`;
  });

  // 6. Email Config
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: `"Veda Kirana POS" <${process.env.EMAIL_USER}>`,
    to: 'vedanidhikothur@gmail.com, kothurramu@gmail.com, vedakiranaandgeneral@gmail.com', // ADD YOUR EMAILS HERE
    subject: `Daily Business Report - ${today}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #4F46E5;">Veda Kirana: Daily Summary</h2>
        <p>Total Revenue: <strong>₹${(sales || []).reduce((s, x) => s + (x.total || 0), 0).toFixed(2)}</strong></p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f3f4f6;">
            <th style="padding:8px; text-align:left;">Item</th>
            <th>Sold</th>
            <th style="text-align:right;">Revenue</th>
          </tr>
          ${summaryRows || '<tr><td colspan="3" style="padding:20px; text-align:center;">No items sold today.</td></tr>'}
        </table>
        <p style="margin-top:20px; font-size: 12px; color: #777;">
          The full inventory spreadsheet (${allProducts.length} items) is attached.
        </p>
      </div>`,
    attachments: [{ filename: `Inventory_Report_${today}.csv`, content: csvContent }]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Email failed to send:", err);
  }
}

sendVyaparStyleReport();
