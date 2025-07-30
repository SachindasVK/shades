const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReport = async (req, res) => {
  try {
    const { reportType, dateFrom, dateTo, page, limit, format } = req.query;

    let dateFilter = { status: { $in: ["delivered", 'confirmed'] } };

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);


    if (reportType) {
      switch (reportType) {
        case "daily":
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
          break;


        case "weekly":
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - dayOfWeek);
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
          break;

        case "monthly":
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
          break;


        case "yearly":
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          dateFilter.createdAt = { $gte: startOfYear, $lte: endOfYear };
          break;

        case "custom":
          if (dateFrom && dateTo) {
            const startDateObj = new Date(dateFrom);
            const endDateObj = new Date(dateTo);
            endDateObj.setHours(23, 59, 59, 999);
            dateFilter.createdAt = {
              $gte: startDateObj,
              $lte: endDateObj
            };
          } else {
            console.warn("Custom report selected without valid dates:", dateFrom, dateTo);
          }
          break;


      }
    }

    console.log("Final Date Filter:", dateFilter);

    // Totals
    const totalSalesCount = await Order.countDocuments(dateFilter);

    const totalRevenueResult = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } }
    ]);
    const totalOrderAmount = totalRevenueResult[0]?.total || 0;

    const totalDiscountResult = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$discount" } } }
    ]);
    const totalDiscount = totalDiscountResult[0]?.total || 0;


    if (format === "pdf" || format === "excel") {
      const allSalesData = await Order.find(dateFilter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .lean();

      const fileName = `sales_report_${reportType || "all"}_${new Date().toISOString().split("T")[0]}`;

      if (format === "pdf") {
        return await generatePDFReport(res, allSalesData, {
          fileName: `${fileName}.pdf`,
          reportType,
          dateFrom,
          dateTo,
          totalSalesCount,
          totalOrderAmount,
          totalDiscount
        });
      } else {
        return await generateExcelReport(res, allSalesData, {
          fileName: `${fileName}.xlsx`,
          reportType,
          dateFrom,
          dateTo,
          totalSalesCount,
          totalOrderAmount,
          totalDiscount
        });
      }
    }


    const currentPage = parseInt(page) || 1;
    const pageLimit = parseInt(limit) || 10;
    const skip = (currentPage - 1) * pageLimit;

    const salesData = await Order.find(dateFilter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean();

    const totalPages = Math.ceil(totalSalesCount / pageLimit);

    res.render("salesReport", {
      pageTitle: "Sales Report",
      totalSalesCount,
      totalOrderAmount,
      totalDiscount,
      salesData,
      currentPage,
      totalPages,
      limit: pageLimit,
      reportType,
      dateFrom,
      dateTo,
      page: currentPage,
    });

  } catch (error) {
    console.error("Sales Report Error:", error.message);
    res.status(500).render("error", {
      pageTitle: "Error",
      message: "An error occurred while generating the sales report. Please try again later.",
    });
  }
};




const generatePDFReport = async (res, salesData, options) => {
  try {
    const { fileName, reportType, dateFrom, dateTo, totalSalesCount, totalOrderAmount, totalDiscount } = options;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

    // Report period
    let periodText = 'All Time';
    if (reportType === 'custom' && dateFrom && dateTo) {
      periodText = `${dateFrom} to ${dateTo}`;
    } else if (reportType) {
      periodText = reportType.charAt(0).toUpperCase() + reportType.slice(1);
    }

    doc.fontSize(12).text(`Report Period: ${periodText}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Summary:', { underline: true });
    doc.fontSize(12);
    doc.text(`Total Sales Count: ${totalSalesCount}`);
    doc.text(`Total Order Amount: ₹${totalOrderAmount.toLocaleString('en-IN')}`);
    doc.text(`Total Discount: ₹${totalDiscount.toLocaleString('en-IN')}`);
    doc.text(`Net Sales: ₹${(totalOrderAmount - totalDiscount).toLocaleString('en-IN')}`);
    doc.moveDown();

    // Table header
    doc.fontSize(14).text('Detailed Report:', { underline: true });
    doc.moveDown();

    const columns = [
      { label: 'Order ID', width: 90 },
      { label: 'Date', width: 60 },
      { label: 'Customer', width: 90 },
      { label: 'Amount', width: 60 },
      { label: 'Discount', width: 60 },
      { label: 'Payment', width: 60 },
      { label: 'Products', width: 120 }
    ];

    const drawTableHeader = (doc, y) => {
      let x = 50;
      doc.font('Helvetica-Bold').fontSize(10);
      columns.forEach(col => {
        doc.rect(x, y, col.width, 20).stroke();
        doc.text(col.label, x + 2, y + 5, {
          width: col.width - 4,
          align: 'left'
        });
        x += col.width;
      });
    };

    let y = doc.y;
    drawTableHeader(doc, y);
    y += 20;

    if (salesData.length > 0) {
      doc.font('Helvetica').fontSize(9);

      salesData.forEach((sale, index) => {
        const productNames = sale.orderedItems?.map(item => item.productName).join(', ') || '';

        const rowData = [
          sale.orderId,
          new Date(sale.createdOn).toLocaleDateString('en-GB'),
          sale.userId?.name || 'Guest',
          `₹${sale.finalAmount.toFixed(2)}`,
          `₹${sale.discount.toFixed(2)}`,
          sale.paymentMethod,
          productNames
        ];

      
        const cellHeights = rowData.map((text, i) => {
          return doc.heightOfString(text, {
            width: columns[i].width - 4,
            align: 'left'
          });
        });

        const rowHeight = Math.max(...cellHeights) + 10;

        if (y + rowHeight > 750) {
          doc.addPage();
          y = 50;
          drawTableHeader(doc, y);
          y += 20;
          doc.font('Helvetica').fontSize(9); // <- reset font for row data
        }


        // Draw the row
        let x = 50;
        rowData.forEach((text, i) => {
          const col = columns[i];
          doc.rect(x, y, col.width, rowHeight).stroke();
          doc.text(text, x + 2, y + 5, {
            width: col.width - 4,
            align: 'left'
          });
          x += col.width;
        });

        y += rowHeight;
      });
    } else {
      doc.moveDown().text('No sales data found for the selected period.');
    }

    doc.end();

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).send('Error generating PDF report');
  }
};

// Excel Generation Function
const generateExcelReport = async (res, salesData, options) => {
  try {
    const { fileName, reportType, dateFrom, dateTo, totalSalesCount, totalOrderAmount, totalDiscount } = options;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    // Report period
    let periodText = 'All Time';
    if (reportType === 'custom' && dateFrom && dateTo) {
      periodText = `${dateFrom} to ${dateTo}`;
    } else if (reportType) {
      periodText = reportType.charAt(0).toUpperCase() + reportType.slice(1);
    }

    summarySheet.addRows([
      { metric: 'Report Period', value: periodText },
      { metric: 'Generated On', value: new Date().toLocaleDateString('en-GB') },
      { metric: '', value: '' },
      { metric: 'Total Sales Count', value: totalSalesCount },
      { metric: 'Total Order Amount', value: `₹${totalOrderAmount.toLocaleString('en-IN')}` },
      { metric: 'Total Discount', value: `₹${totalDiscount.toLocaleString('en-IN')}` },
      { metric: 'Net Sales', value: `₹${(totalOrderAmount - totalDiscount).toLocaleString('en-IN')}` }
    ]);

    // Detailed Report Sheet
    const detailSheet = workbook.addWorksheet('Detailed Report');
    detailSheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Customer Email', key: 'customerEmail', width: 25 },
      { header: 'Product Names', key: 'productNames', width: 40 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Final Amount', key: 'finalAmount', width: 15 }
    ];

    salesData.forEach(sale => {
      const productNames = sale.orderedItems?.map(item => item.productName).join(', ') || 'N/A';

      detailSheet.addRow({
        orderId: sale.orderId,
        date: new Date(sale.createdOn).toLocaleDateString('en-GB'),
        customerName: sale.userId?.name || 'Guest',
        customerEmail: sale.userId?.email || 'N/A',
        productNames: productNames,
        paymentMethod: sale.paymentMethod || 'N/A',
        status: sale.status,
        discount: sale.discount.toFixed(2),
        finalAmount: sale.finalAmount.toFixed(2)
      });
    });

    // Style the headers
    summarySheet.getRow(1).font = { bold: true };
    detailSheet.getRow(1).font = { bold: true };

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel Generation Error:', error);
    res.status(500).send('Error generating Excel report');
  }
};

// Download route handler
const downloadSalesReport = async (req, res) => {
  req.query.format = req.query.format || 'pdf';
  return getSalesReport(req, res);
};

module.exports = {
  getSalesReport,
  downloadSalesReport
};