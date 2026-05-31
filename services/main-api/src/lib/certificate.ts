import PDFDocument = require("pdfkit");

// FR-3.5: data shown on a purchase's licence certificate. Kept to the same
// non-sensitive fields the public /verify endpoint exposes, plus the buyer name
// (the certificate is only handed to the buyer themselves, behind auth).
export interface CertificateData {
    licenseKey: string;
    licenseType: string;
    assetTitle: string;
    sellerName: string;
    buyerName: string;
    purchasedAt: Date;
}

// Builds the certificate PDF and returns the document as a readable stream.
// The caller pipes it straight to the HTTP response — nothing is written to disk
// or S3, so the PDF is generated on demand each time it's requested.
export function buildCertificate(data: CertificateData): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: "A4", margin: 56 });

    doc
        .fontSize(24)
        .text("Licence Certificate", { align: "center" })
        .moveDown(0.3)
        .fontSize(12)
        .fillColor("#666")
        .text("PasarPixel Digital Asset Marketplace", { align: "center" })
        .fillColor("#000")
        .moveDown(2);

    const row = (label: string, value: string) => {
        doc.fontSize(11).fillColor("#666").text(label);
        doc.fontSize(14).fillColor("#000").text(value).moveDown(0.8);
    };

    row("Asset", data.assetTitle);
    row("Seller", data.sellerName);
    row("Licensed to", data.buyerName);
    row("Licence type", data.licenseType);
    row("Purchase date", data.purchasedAt.toLocaleDateString());
    row("Licence key", data.licenseKey);

    doc
        .moveDown(2)
        .fontSize(9)
        .fillColor("#999")
        .text(
            "Verify this licence at /verify using the licence key above.",
            { align: "center" }
        );

    doc.end();
    return doc;
}
