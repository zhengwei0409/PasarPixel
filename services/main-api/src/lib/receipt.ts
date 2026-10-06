import PDFDocument = require("pdfkit");

interface ReceiptData {
    orderId: number;
    buyerName: string;
    createdAt: Date;
    currency: string;
    totalAmount: number;
    items: { title: string; licenseType: string; price: number }[];
}

export function buildReceipt(data: ReceiptData): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const money = (amount: number) => `${data.currency} ${amount.toFixed(2)}`;
    doc.fillColor("#30392b").fontSize(24).text("Order Receipt");
    doc.fontSize(11).fillColor("#73776e").text("PasarPixel Digital Asset Marketplace").moveDown(2);
    doc.fillColor("#252823").fontSize(12)
        .text(`Order #${data.orderId}`)
        .text(`Date: ${data.createdAt.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "long", day: "numeric" })}`)
        .text(`Purchased by: ${data.buyerName}`)
        .text("Payment status: Paid")
        .moveDown(2);
    for (const item of data.items) {
        if (doc.y > 690) doc.addPage();
        doc.fillColor("#252823").fontSize(12).text(item.title);
        doc.fillColor("#73776e").fontSize(10)
            .text(`${item.licenseType === "PERSONAL" ? "Personal" : "Commercial"} license`)
            .text(money(item.price), { align: "right" })
            .moveDown();
    }
    if (doc.y > 650) doc.addPage();
    doc.moveDown().fillColor("#30392b").fontSize(16)
        .text(`Total paid: ${money(data.totalAmount)}`, { align: "right" });
    doc.moveDown(2).fontSize(10).fillColor("#73776e")
        .text("Thank you for your purchase. Your assets and license certificates are available in your PasarPixel purchase history.");
    doc.end();
    return doc;
}
