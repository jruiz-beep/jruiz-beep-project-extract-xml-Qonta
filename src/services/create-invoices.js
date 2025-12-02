const { connection } = require("../config/database.js");
const { v4: uuid } = require("uuid");
const chalk = require("chalk");

const addFiveHours = (date) => {
  const adjustedDate = new Date(date);
  adjustedDate.setHours(adjustedDate.getHours() + 5);
  return adjustedDate.toISOString();
};

const validateInvoice = (invoice) => {
  if (!invoice || !Array.isArray(invoice.ItemsCufeXML)) {
    throw new Error("La factura no tiene el formato esperado.");
  }
};

const createInvoices = async (invoices) => {
  const invoiceData = [];
  const AllowanceChargeGlobal = [];
  const lineData = [];
  const taxData = [];
  const allowanceChargeData = [];
  const taxSubtotalsData = [];

  try {
    // console.log(chalk.green(`La factura con CUFE ${JSON.stringify(invoices)}`));
    for (const invoice of invoices) {
      validateInvoice(invoice);

      let existingInvoice = null
      await connection.$transaction(async (prismaTx) => {
        existingInvoice = await prismaTx.cufesXML.findFirst({
          where: {
            CUFE: invoice.CUFE,
          },
        });
      })

      if (existingInvoice) {
        console.log(chalk.redBright(`La factura con CUFE ${invoice.CUFE} ya existe.`));
        continue; // Saltar esta factura si ya existe
      }

      const invoiceId = uuid();

      invoiceData.push({
        Id: invoiceId,
        NumeroFactura: invoice.NumeroFactura || "N/A",
        Emisor: invoice.Emisor || "N/A",
        TipoFactura: invoice.TipoFactura || "N/A",
        FechaEmision: addFiveHours(invoice.FechaEmision || new Date()),
        FechaVencimiento: addFiveHours(invoice.FechaVencimiento || new Date()),
        CUFE: invoice.CUFE || "N/A",
        ValorTotal: parseFloat(invoice.ValorTotal) || 0,
        FormaPago: invoice.FormaPago || "N/A",
        Auxiliar: invoice.Auxiliar || "{}",
        Notas: invoice.Notas,
      });
      
      for (const allowanceCharge of invoice.AllowanceCharge || []) {
        const allowanceChargeId = uuid();
        AllowanceChargeGlobal.push({
          Id: allowanceChargeId,
          CufeXMLFK: invoiceId,
          ChargeIndicator:  Boolean(allowanceCharge.ChargeIndicator) || null,
          AllowanceChargeReasonCode: allowanceCharge.AllowanceChargeReasonCode || null,
          AllowanceChargeReason: allowanceCharge.AllowanceChargeReason || "N/A",
          MultiplierFactorNumeric: parseFloat(allowanceCharge.MultiplierFactorNumeric) || 0,
          Amount: parseFloat(allowanceCharge.Amount) || 0,
          BaseAmount: parseFloat(allowanceCharge.BaseAmount) || 0,
        });
      }
      
      for (const line of invoice.ItemsCufeXML || []) {
        const lineId = uuid();

        // Extraer descuentos/cargos y subtotales de impuestos
        const { ItemsCufeXMLTaxes, ItemsCufeXMLAllowanceCharge, ...lineFields } = line;


        lineData.push({
          Id: lineId,
          CufeXMLFK: invoiceId,
          ItemId: line.ItemId || "N/A",
          InvoicedQuantity: parseFloat(line.InvoicedQuantity) || 0,
          InvoiceQuantityUnitCode: line.InvoiceQuantityUnitCode || "N/A",
          LineExtensionAmount: parseFloat(line.LineExtensionAmount) || 0,
          LineExtensionAmountCurrency: line.LineExtensionAmountCurrency || "N/A",
          FreeOfChargeIndicator: line.FreeOfChargeIndicator || false,
          Description: Array.isArray(line.Description)
            ? line.Description.join(', ')
            : (typeof line.Description === 'string' ? line.Description : "N/A"),
          PriceAmount: parseFloat(line.PriceAmount) || 0,
          PriceAmountCurrency: line.PriceAmountCurrency || "N/A",
          BaseQuantity: parseFloat(line.BaseQuantity) || 0,
          BaseQuantityUnitCode: line.BaseQuantityUnitCode || "N/A",
        });

        // Procesar `ItemsCufeXMLTaxes`
        for (const tax of ItemsCufeXMLTaxes || []) {
          const taxId = uuid();
          taxData.push({
            Id: taxId,
            ItemCufeXMLFK: lineId,
            TaxAmount: parseFloat(tax.TaxAmount) || 0,
            TaxAmountCurrency: tax.TaxAmountCurrency || "N/A",
            RoundingAmount: parseFloat(tax.RoundingAmount) || 0,
            RoundingAmountCurrency: tax.RoundingAmountCurrency || "N/A",
          });

          // Procesar `ItemCufeXMLTaxSubtotals`
          for (const taxSubtotal of tax.ItemCufeXMLTaxSubtotals || []) {
            const taxSubtotalId = uuid();
            taxSubtotalsData.push({
              Id: taxSubtotalId,
              ItemCufeXMLTaxFK: taxId,
              TaxableAmount: parseFloat(taxSubtotal.TaxableAmount) || 0,
              TaxableAmountCurrency: taxSubtotal.TaxableAmountCurrency || "N/A",
              TaxAmount: parseFloat(taxSubtotal.TaxAmount) || 0,
              TaxAmountCurrency: taxSubtotal.TaxAmountCurrency || "N/A",
              NumPercent: parseFloat(taxSubtotal.NumPercent) || 0,
              TaxSchemeID: taxSubtotal.TaxSchemeID || "N/A",
              TaxSchemeName: taxSubtotal.TaxSchemeName || "N/A",
            });
          }
        }

        // Procesar `ItemsCufeXMLAllowanceCharge`
        for (const allowanceCharge of ItemsCufeXMLAllowanceCharge || []) {
          const allowanceChargeId = uuid();
          allowanceChargeData.push({
            Id: allowanceChargeId,
            ItemCufeXMLFK: lineId,
            ItemId: typeof allowanceCharge.ItemId === "string" && allowanceCharge.ItemId.trim() !== ""
              ? allowanceCharge.ItemId
              : "N/A",
            AllowanceChargeReason: allowanceCharge.AllowanceChargeReason &&
              Object.keys(allowanceCharge.AllowanceChargeReason).length > 0
              ? allowanceCharge.AllowanceChargeReason
              : "N/A",
            MultiplierFactorNumeric: parseFloat(allowanceCharge.MultiplierFactorNumeric) || 0,
            Amount: parseFloat(allowanceCharge.Amount) || 0,
            AmountCurrency: allowanceCharge.AmountCurrency || "N/A",
            BaseAmount: parseFloat(allowanceCharge.BaseAmount) || 0,
            BaseAmountCurrency: allowanceCharge.BaseAmountCurrency || "N/A",
            ChargeIndicator: allowanceCharge.ChargeIndicator || false,
          });
        }
      }
    }

    await connection.$transaction(async (prismaTx) => {
      // Inserciones masivas
      if (invoiceData.length > 0) await prismaTx.cufesXML.createMany({ data: invoiceData });
      if (AllowanceChargeGlobal.length > 0) await prismaTx.CufeXMLAllowanceCharges.createMany({ data: AllowanceChargeGlobal });
      if (lineData.length > 0) await prismaTx.itemsCufeXML.createMany({ data: lineData });
      if (taxData.length > 0) await prismaTx.itemCufeXMLTaxes.createMany({ data: taxData });
      if (allowanceChargeData.length > 0) await prismaTx.ItemCufeXMLAllowanceCharges.createMany({ data: allowanceChargeData });
      if (taxSubtotalsData.length > 0) await prismaTx.itemCufeXMLTaxSubtotals.createMany({ data: taxSubtotalsData });
    });
  } catch (error) {
    console.error("Error al procesar las facturas:", error);
    console.error("Datos que fallaron:", { taxData }); // Debug
    throw new Error(`Error al crear facturas: ${error.message}`);
  }
};

module.exports = { createInvoices };