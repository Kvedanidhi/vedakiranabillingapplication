const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Initialize Supabase with keys from environment
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function runReport() {
    try {
        console.log("Fetching Monthly Data...");
        
        // 1. Get Date Range (Last Month)
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        // 2. Fetch Sales
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', firstDay)
            .lte('created_at', lastDay);

        if (salesError) throw salesError;

        // 3. Prepare CSV Data
        let csvContent = "Date,Customer,Total,Items Sold\n";
        
        if (sales && sales.length > 0) {
            sales.forEach(s => {
                const date = new Date(s.created_at).toLocaleDateString();
                const customer = (s.customer_name || "Cash").replace(/,/g, "");
                const itemCount = s.items ? s.items.length : 0;
                csvContent += `${date},${customer},${s.total},${itemCount}\n`;
            });
        } else {
            csvContent += "No sales data found for this period,,\n";
        }

        // 4. Send Email
        const transporter = nodemailer.createTransport({
            service: 'vedanidhikothur@gmail.com, kothurramu@gmail.com',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: `"Veda Kirana Reports" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Sends to yourself + add others with a comma
            subject: `Monthly Report: ${new Date().toLocaleString('default', { month: 'long' })}`,
            html: `<p>Please find the monthly sales spreadsheet attached.</p><p>Total Sales Found: <b>${sales ? sales.length : 0}</b></p>`,
            attachments: [{ filename: 'Monthly_Report.csv', content: csvContent }]
        });

        console.log("Report Sent Successfully!");
    } catch (err) {
        console.error("Report Failed:", err.message);
        process.exit(1); // Tells GitHub that the job failed
    }
}

runReport();
