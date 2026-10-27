// src/lib/statement.ts — put this SAME file in BOTH apps (Coins/src/lib and Staff/src/lib)
// npm i jspdf jspdf-autotable   (in both projects)
// Logo: copy Coins/public/logo-light.jpeg into Staff/public/ as well.

export const COMPANY = {
  name: "Coinspace (Pvt) Ltd",
  tagline: "Forex, Metal, Synthetic and Crypto Trading",
  address: "Harare, Zimbabwe", // TODO: your full address
  email: "support@coinspace.co.zw", // TODO: edit
  phone: "+263 00 000 0000", // TODO: edit
  web: "www.coinspace.co.zw", // TODO: edit
};

export type StatementRow = {
  created_at: string;
  kind: string;
  amount: number | string;
  platform: string;
  reference: string;
  status: string;
  client?: { name?: string | null } | null;
};

type Opts = {
  title: string; // e.g. "Account statement" | "Transaction report"
  rows: StatementRow[];
  filename: string;
  clientName?: string; // when set => single-client statement
  clientPhone?: string;
  logoUrl?: string;
};

type RGB = [number, number, number];
const INK: RGB = [10, 12, 12];
const GOLD: RGB = [245, 184, 0];
const GREEN: RGB = [22, 130, 70];
const RED: RGB = [200, 40, 40];
const MUTED: RGB = [110, 110, 105];

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dt = (d: string) =>
  day(d) + " " + new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const statusLabel = (s: string) => (s === "review" ? "In review" : s.charAt(0).toUpperCase() + s.slice(1));

// the logo file has a lot of white padding, so crop to the artwork
async function loadLogo(url: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const sx = Math.round(bmp.width * 0.068);
    const sy = Math.round(bmp.height * 0.39);
    const sw = Math.round(bmp.width * 0.82);
    const sh = Math.round(bmp.height * 0.22);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    return { data: canvas.toDataURL("image/jpeg", 0.92), ratio: sw / sh };
  } catch {
    return null;
  }
}

export async function downloadStatement(o: Opts) {
  const [{ jsPDF }, at] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = at.default;

  const rows = o.rows
    .filter((r) => r.kind === "deposit" || r.kind === "withdrawal")
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const approved = rows.filter((r) => r.status === "approved");
  const dep = approved.filter((r) => r.kind === "deposit").reduce((s, r) => s + Number(r.amount), 0);
  const wd = approved.filter((r) => r.kind === "withdrawal").reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter((r) => r.status === "review").length;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const now = new Date();

  // top brand bar + logo
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 4, "F");
  const logo = await loadLogo(o.logoUrl ?? "/logo-light.jpeg");
  if (logo) {
    const lw = 64;
    doc.addImage(logo.data, "JPEG", M, 12, lw, lw / logo.ratio);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...INK).text("COINSPACE", M, 20);
  }

  // title block
  const stmtNo = `CS-${now.toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(17).text(o.title.toUpperCase(), W - M, 17, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(`No. ${stmtNo}`, W - M, 23, { align: "right" });
  doc.text(`Generated ${dt(now.toISOString())}`, W - M, 27.5, { align: "right" });
  doc.setDrawColor(225, 225, 220).line(M, 34, W - M, 34);

  // company (left) + client / scope (right)
  let y = 41;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK).text(COMPANY.name, M, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  [COMPANY.address, COMPANY.email, COMPANY.phone, COMPANY.web].forEach((t, i) => doc.text(t, M, y + 5 + i * 4.2));

  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED).text(o.clientName ? "STATEMENT FOR" : "REPORT SCOPE", W - M, y, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text(o.clientName ?? "All clients", W - M, y + 5.5, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  let ry = y + 10.5;
  if (o.clientPhone && o.clientPhone !== "—") { doc.text(o.clientPhone, W - M, ry, { align: "right" }); ry += 4.2; }
  const period = rows.length ? `${day(rows[0].created_at)} – ${day(rows[rows.length - 1].created_at)}` : "No transactions";
  doc.text(`Period: ${period}`, W - M, ry, { align: "right" });

  // summary boxes
  y = 66;
  const boxes: [string, string, RGB][] = [
    ["DEPOSITS (APPROVED)", fmt(dep), GREEN],
    ["WITHDRAWALS (APPROVED)", fmt(wd), RED],
    ["NET MOVEMENT", (dep - wd < 0 ? "-" : "") + fmt(Math.abs(dep - wd)), INK],
    ["TRANSACTIONS", `${rows.length}${pending ? `  (${pending} in review)` : ""}`, INK],
  ];
  const bw = (W - 2 * M - 9) / 4;
  boxes.forEach(([label, val, color], i) => {
    const x = M + i * (bw + 3);
    doc.setFillColor(246, 246, 242).roundedRect(x, y, bw, 19, 2, 2, "F");
    doc.setFillColor(...GOLD).rect(x, y + 3, 1, 13, "F");
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...MUTED).text(label, x + 4, y + 6.5);
    doc.setFontSize(i === 3 ? 10 : 12).setTextColor(...color).text(val, x + 4, y + 14);
  });

  // transactions table
  const showClient = !o.clientName;
  const head = ["Date", "Reference", "Type", "Method", ...(showClient ? ["Client"] : []), "Status", "Amount"];
  const body = rows.map((r) => [
    dt(r.created_at),
    r.reference,
    r.kind === "deposit" ? "Deposit" : "Withdrawal",
    r.platform,
    ...(showClient ? [r.client?.name ?? "—"] : []),
    statusLabel(r.status),
    (r.kind === "deposit" ? "+" : "-") + fmt(Number(r.amount)),
  ]);
  const last = head.length - 1;

  autoTable(doc, {
    startY: y + 26,
    head: [head],
    body: body.length ? body : [[{ content: "No transactions to show.", colSpan: head.length, styles: { halign: "center" } } as any]],
    margin: { left: M, right: M, bottom: 26 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: [232, 232, 226], lineWidth: 0.1 },
    headStyles: { fillColor: GOLD, textColor: INK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 247] },
    columnStyles: { [last]: { halign: "right", fontStyle: "bold" } },
    didParseCell: (d: any) => {
      if (d.section !== "body" || !rows[d.row.index]) return;
      const r = rows[d.row.index];
      if (r.status === "rejected") d.cell.styles.textColor = MUTED;
      if (d.column.index === last && r.status === "approved") d.cell.styles.textColor = r.kind === "deposit" ? GREEN : RED;
      if (d.column.index === last - 1) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = r.status === "approved" ? GREEN : r.status === "rejected" ? RED : [160, 110, 0];
      }
    },
  });

  // footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 225, 220).line(M, H - 20, W - M, H - 20);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(`${COMPANY.name} · ${COMPANY.address} · ${COMPANY.email} · ${COMPANY.phone}`, M, H - 15);
    doc.text("System-generated document. Only approved transactions count towards totals. Amounts in USD.", M, H - 11.5);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 15, { align: "right" });
    doc.setFillColor(...GOLD).rect(0, H - 3, W, 3, "F");
  }

  doc.save(o.filename);
}