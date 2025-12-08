const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// 1. Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendReport() {
  console.log("Starting Daily Report...");

  // 2. Get Today's Date (UTC is used for simplicity in database queries)
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; 
  
  // 3. Query Supabase for Today's Sales
  // We check for sales created on or after today's date
  const { data: sales, error } = await supabase
    .from('sales')
    .select('total')
    .gte('created_at', `${dateString}T00:00:00.000Z`);

  if (error) {
    console.error("Error fetching sales:", error);
    process.exit(1);
  }

  // 4. Calculate Totals
  const totalBills = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

  console.log(`Found ${totalBills} bills totaling ₹${totalRevenue}`);

  // 5. Configure Email Transporter (Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 6. Send Email
  const mailOptions = {
    from: `"Veda Kirana POS" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, 
    subject: `Daily Sales Report - ${dateString}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #4F46E5;">Veda Kirana Daily Report</h2>
        <p>Sales summary for <strong>${dateString}</strong>:</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <div style="display: flex; gap: 20px;">
            <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; width: 45%;">
                <p style="margin: 0; font-size: 14px; color: #6B7280;">Total Bills</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #111827;">${totalBills}</p>
            </div>
            <div style="background: #ECFDF5; padding: 15px; border-radius: 8px; width: 45%;">
                <p style="margin: 0; font-size: 14px; color: #047857;">Total Revenue</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #059669;">₹${totalRevenue.toFixed(2)}</p>
            </div>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #9CA3AF;">Automated by GitHub Actions</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log("Email sent successfully!");
}

sendReport();
