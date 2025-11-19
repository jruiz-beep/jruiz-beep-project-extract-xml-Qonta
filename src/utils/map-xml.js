const parser = require("xml2json");
const chalk = require("chalk");

const mapXmlToJSON = (xml) => {
  var json = JSON.parse(
    parser.toJson(xml, {
      arrayNotation: false,
    })
  );
  let notas = json.Invoice["cbc:Note"] || '';
  if (!Array.isArray(notas)) {
    notas = [notas]; // convertir a array si es una sola nota
  }
  const notasLimpias = notas.map(nota => {
    if (typeof nota === 'object' && nota !== null) {
      return nota.$t || JSON.stringify(nota);
    }
    return String(nota);
  });
  const notasUnidas = notasLimpias.join('\n');
  
  // Calcular ValorPropina de forma robusta: soporta cac:AllowanceCharge como
  // objeto o array y selecciona el allowance que parece ser la propina
  // (ChargeIndicator === true, o AllowanceChargeReason contiene 'Propina', o ReasonCode === '01').
  let valorPropina = 0;
  const allowanceRoot = json["Invoice"]["cac:AllowanceCharge"];
  if (allowanceRoot) {
    const allowances = Array.isArray(allowanceRoot) ? allowanceRoot : [allowanceRoot];
    const tip = allowances.find((a) => {
      const chargeIndicator = a["cbc:ChargeIndicator"];
      // chargeIndicator puede venir como objeto, string o boolean
      const indicatorBool = typeof chargeIndicator === "object"
        ? Boolean(chargeIndicator["$t"] || chargeIndicator)
        : Boolean(chargeIndicator);
      const reason = a["cbc:AllowanceChargeReason"] || "";
      const reasonCode = a["cbc:AllowanceChargeReasonCode"];
      return (
        indicatorBool === true ||
        (typeof reason === "string" && reason.toLowerCase().includes("propina")) ||
        reasonCode === "01"
      );
    });
    if (tip && tip["cbc:Amount"]) {
      valorPropina = tip["cbc:Amount"]["$t"] || tip["cbc:Amount"] || 0;
    }
  }
  
  const Proveedor = {
    CodigoPostal: String(json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"]["cac:PartyTaxScheme"]?.["cac:RegistrationAddress"]?.["cbc:PostalZone"]) || null,
    Municipio: String(json["Invoice"]['cac:AccountingSupplierParty']['cac:Party']['cac:PartyTaxScheme']['cac:RegistrationAddress']['cbc:ID']) || null, //*campo nuevo
    // original raw value (may be like "O-13;O-15;O-23" or "R-99-PN")
    ResponsabilidadesFiscales: String(json["Invoice"]['cac:AccountingSupplierParty']['cac:Party']['cac:PartyTaxScheme']['cbc:TaxLevelCode']) || null, //*campo nuevo
    // normalized numeric codes extracted from the TaxLevelCode when possible
    // example: "O-13;O-15;O-23" -> ["13","15","23"]
    ResponsabilidadesFiscalesCodigo: (() => {
      try {
        const raw = String(json["Invoice"]['cac:AccountingSupplierParty']['cac:Party']['cac:PartyTaxScheme']['cbc:TaxLevelCode'] || "");
        if (!raw) return null;
        const parts = raw.split(';').map(p => p.trim()).filter(Boolean);
        const codes = [];
        for (const p of parts) {
          const m = p.match(/^O-(\d+)$/i);
          if (m) codes.push(m[1]);
        }
        return codes.length ? codes : null;
      } catch (e) {
        return null;
      }
    })(),
    Direccion: String(json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"]["cac:PartyTaxScheme"]?.["cac:RegistrationAddress"]?.["cac:AddressLine"]?.["cbc:Line"]) || null,
    Telefono: String(json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"]["cac:Contact"]["cbc:Telephone"]),
    Correo: String(json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"]["cac:Contact"]["cbc:ElectronicMail"]),
    TipoDocumento: String(json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"]["cac:PartyLegalEntity"]["cbc:CompanyID"]["schemeName"]),
  }
  const invoice = {
    NumeroFactura: json["Invoice"]["cbc:ID"],
    Emisor:
      json["Invoice"]["cac:AccountingSupplierParty"]["cac:Party"][
      "cac:PartyLegalEntity"
      ]["cbc:RegistrationName"],
    TipoFactura: json["Invoice"]["cbc:InvoiceTypeCode"]["$t"],
    FechaEmision: `${json["Invoice"]["cbc:IssueDate"]} ${json["Invoice"]["cbc:IssueTime"]}`,
    //FechaVencimiento: json["Invoice"]["cbc:DueDate"],
    FechaVencimiento: json["Invoice"]["cac:PaymentMeans"]["cbc:PaymentDueDate"],
    CUFE: json["Invoice"]["cbc:UUID"]["$t"],
    ValorTotal: json["Invoice"]["cac:LegalMonetaryTotal"]["cbc:PayableAmount"]["$t"],
    FormaPago: json["Invoice"]["cac:PaymentMeans"]["cbc:ID"]?.["$t"] ? json["Invoice"]["cac:PaymentMeans"]["cbc:ID"]?.["$t"] : json["Invoice"]["cac:PaymentMeans"]["cbc:ID"],
    Notas: notasUnidas,
    Auxiliar: JSON.stringify(Proveedor),
    ValorPropina: valorPropina,
  };

  const invoiceLines = json?.Invoice?.["cac:InvoiceLine"];

  if (invoiceLines) {
    const lines = Array.isArray(invoiceLines) ? invoiceLines : [invoiceLines];
    invoice.ItemsCufeXML = lines.map((line) => {
      const item = {
        ItemId: line["cbc:ID"]?.["$t"] ? line["cbc:ID"]?.["$t"] : line["cbc:ID"],
        InvoicedQuantity: line["cbc:InvoicedQuantity"]?.["$t"] || 0,
        InvoiceQuantityUnitCode:
          line["cbc:InvoicedQuantity"]?.["unitCode"] || "Sin unidad",
        LineExtensionAmount: line["cbc:LineExtensionAmount"]?.["$t"] || 0,
        LineExtensionAmountCurrency:
          line["cbc:LineExtensionAmount"]?.["currencyID"],
        FreeOfChargeIndicator: Boolean(line["cbc:FreeOfChargeIndicator"]),
        Description: line["cac:Item"]?.["cbc:Description"],
        PriceAmount: line["cac:Price"]?.["cbc:PriceAmount"]?.["$t"] || 0,
        PriceAmountCurrency:
          line["cac:Price"]?.["cbc:PriceAmount"]?.["currencyID"],
        BaseQuantity: line["cac:Price"]?.["cbc:BaseQuantity"]?.["$t"],
        BaseQuantityUnitCode:
          line["cac:Price"]?.["cbc:BaseQuantity"]?.["unitCode"],
      };

      if (line.hasOwnProperty("cac:AllowanceCharge")) {
        const allowanceCharge = Array.isArray(line["cac:AllowanceCharge"]) ? line["cac:AllowanceCharge"] : [line["cac:AllowanceCharge"]];
        item.ItemsCufeXMLAllowanceCharge = allowanceCharge
          .map((allowanceCharge) => {
            return {
              ItemId: allowanceCharge["cbc:ID"],
              ChargeIndicator: Boolean(allowanceCharge["cbc:ChargeIndicator"]),
              AllowanceChargeReason: allowanceCharge["cbc:AllowanceChargeReason"],
              MultiplierFactorNumeric: allowanceCharge["cbc:MultiplierFactorNumeric"],
              Amount: allowanceCharge["cbc:Amount"]["$t"],
              AmountCurrency: allowanceCharge["cbc:Amount"]["currencyID"],
              BaseAmount: allowanceCharge["cbc:BaseAmount"]["$t"],
              BaseAmountCurrency: allowanceCharge["cbc:BaseAmount"]["currencyID"],
            };
          });

      }

      if (line.hasOwnProperty("cac:TaxTotal")) {
        const taxes = Array.isArray(line["cac:TaxTotal"]) ? line["cac:TaxTotal"] : [line["cac:TaxTotal"]];
        item.ItemsCufeXMLTaxes = taxes

          .map((tax) => {
            const newTax = {
              TaxAmount: tax["cbc:TaxAmount"]["$t"],
              TaxAmountCurrency: tax["cbc:TaxAmount"]?.["currencyID"],
              RoundingAmount: tax["cbc:RoundingAmount"]?.["$t"],
              RoundingAmountCurrency: tax["cbc:RoundingAmount"]?.["currencyID"],
            };

            if (tax["cac:TaxSubtotal"]) {
              const taxSubtotals = Array.isArray(tax["cac:TaxSubtotal"]) ? tax["cac:TaxSubtotal"] : [tax["cac:TaxSubtotal"]];
              newTax.ItemCufeXMLTaxSubtotals = taxSubtotals.map((taxSubtotal) => {
                return {
                  TaxableAmount: taxSubtotal["cbc:TaxableAmount"] ? taxSubtotal["cbc:TaxableAmount"]["$t"] : 0,
                  TaxableAmountCurrency: taxSubtotal["cbc:TaxableAmount"]?.["currencyID"],
                  TaxAmount: taxSubtotal["cbc:TaxAmount"]["$t"],
                  TaxAmountCurrency: taxSubtotal["cbc:TaxAmount"]?.["currencyID"],
                  NumPercent: taxSubtotal["cac:TaxCategory"]?.["cbc:Percent"],
                  TaxSchemeID: taxSubtotal["cac:TaxCategory"]?.["cac:TaxScheme"]?.["cbc:ID"],
                  TaxSchemeName: taxSubtotal["cac:TaxCategory"]?.["cac:TaxScheme"]?.["cbc:Name"],
                };
              });

            }
            return newTax

          });
      }
      return item

    });
  }

  return invoice;
};

module.exports = { mapXmlToJSON };
