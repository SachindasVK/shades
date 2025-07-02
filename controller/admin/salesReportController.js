const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReport = async (req, res) => {
  try {
    // Extract query parameters
    const { reportType, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    // Build date filter based on reportType
   let dateFilter = {
  status: { $in: ["delivered", "cancelled","returned"] }
};

    const now = new Date();
    
    if (reportType) {
      switch (reportType) {
        case "daily":
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          dateFilter.createdOn = {
            $gte: startOfDay,
            $lte: endOfDay,
          };
          break;
        case "weekly":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          dateFilter.createdOn = {
            $gte: weekStart,
            $lte: weekEnd,
          };
          break;
        case "monthly":
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          dateFilter.createdOn = {
            $gte: monthStart,
            $lte: monthEnd,
          };
          break;
        case "yearly":
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          dateFilter.createdOn = {
            $gte: yearStart,
            $lte: yearEnd,
          };
          break;
        case "custom":
          if (!dateFrom || !dateTo) {
            return res.status(400).render('error', { 
              message: "Please provide both start and end dates for custom range." 
            });
          }
          const customStart = new Date(dateFrom);
          const customEnd = new Date(dateTo);
          customEnd.setHours(23, 59, 59, 999);
          dateFilter.createdOn = {
            $gte: customStart,
            $lte: customEnd,
          };
          break;
        default:
          // No date filter for "all time"
          break;
      }
    }

    // Count total delivered orders
    const totalSalesCount = await Order.countDocuments(dateFilter);

    // Calculate total order amount (sum of finalAmount)
    const totalRevenueResult = await Order.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$finalAmount" } 
        } 
      },
    ]);
    const totalOrderAmount = totalRevenueResult[0]?.total || 0;

    // Calculate total discount given
    const totalDiscountResult = await Order.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: null, 
          total: { $sum: "$discount" } 
        } 
      },
    ]);
    const totalDiscount = totalDiscountResult[0]?.total || 0;

    // Handle download requests first (before pagination)
    if (req.query.format === "pdf" || req.query.format === "excel") {
      // Fetch all data for download (no pagination)
      const allSalesData = await Order.find(dateFilter)
        .populate("userId", "name email")
        .sort({ createdOn: -1 })
        .lean();

      const format = req.query.format;
      const fileName = `sales_report_${reportType || "all"}_${new Date().toISOString().split('T')[0]}`;
      
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
      } else if (format === "excel") {
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

    // Pagination for regular page view
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch sales data with pagination
    const salesData = await Order.find(dateFilter)
      .populate("userId", "name email")
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Calculate total pages for pagination
    const totalPages = Math.ceil(totalSalesCount / limitNum);

    // Render the sales report page
    res.render("salesReport", {
      pageTitle: "Sales Report",
      totalSalesCount,
      totalOrderAmount,
      totalDiscount,
      salesData,
      currentPage: pageNum,
      totalPages,
      limit: limitNum,
      reportType,
      dateFrom,
      dateTo,
    });

  } catch (error) {
    console.error("Sales Report Error:", error.message);
    res.status(500).render("admin/error", {
      pageTitle: "Error",
      message: "An error occurred while generating the sales report. Please try again later.",
    });
  }
};

// PDF Generation Function
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

    // Table data
    if (salesData.length > 0) {
      salesData.forEach((sale, index) => {
        if (doc.y > 700) {
          doc.addPage();
        }
        
        doc.fontSize(10);
        doc.text(`${index + 1}. Order #${sale.orderId}`, { continued: true });
        doc.text(` | Date: ${new Date(sale.createdOn).toLocaleDateString('en-GB')}`, { continued: true });
        doc.text(` | Customer: ${sale.userId?.name || 'Guest'}`);
        doc.text(`   Amount: ₹${sale.finalAmount.toFixed(2)} | Discount: ₹${sale.discount.toFixed(2)} | Payment: ${sale.paymentMethod}`);
        
        if (sale.orderedItems && sale.orderedItems.length > 0) {
          const productNames = sale.orderedItems.map(item => item.productName).join(', ');
          doc.text(`   Products: ${productNames.substring(0, 80)}${productNames.length > 80 ? '...' : ''}`);
        }
        
        doc.moveDown(0.5);
      });
    } else {
      doc.text('No sales data found for the selected period.');
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
  // This function handles the download route
  // It's essentially the same logic as getSalesReport but focused on downloads
  req.query.format = req.query.format || 'pdf'; // Default to PDF if no format specified
  return getSalesReport(req, res);
};

module.exports = { 
  getSalesReport,
  downloadSalesReport 
};