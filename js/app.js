let m_capability = null;
let m_inkThreshold = null;
let m_penData = [];
let isDown = false;
let lastPoint = { x: 0, y: 0 };

const canvas = document.getElementById("sigCanvas");
const ctx = canvas.getContext("2d");

function clearCanvas() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "white";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function distance(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// Draw a single pen report onto HTML canvas (same idea as demoButtons)
function processPoint(report) {
  const nextPoint = {
    x: Math.round((canvas.width * report.x) / m_capability.tabletMaxX),
    y: Math.round((canvas.height * report.y) / m_capability.tabletMaxY),
  };

  const isDown2 = isDown
    ? !(report.pressure <= m_inkThreshold.offPressureMark)
    : report.pressure > m_inkThreshold.onPressureMark;

  if (!isDown && isDown2) lastPoint = nextPoint;

  if (
    (isDown2 && 10 < distance(lastPoint, nextPoint)) ||
    (isDown && !isDown2)
  ) {
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();
    ctx.closePath();
    lastPoint = nextPoint;
  }

  isDown = isDown2;
}

async function startSignatureCapture() {
  if (!m_tablet) throw new Error("Tablet not connected");

  const p = new WacomGSS.STU.Protocol();

  // Prepare tablet info needed for scaling and pen-up/down detection
  m_inkThreshold = await m_tablet.getInkThreshold();
  m_capability = await m_tablet.getCapability();

  // Reset buffers/UI
  m_penData = [];
  isDown = false;
  lastPoint = { x: 0, y: 0 };
  ctx.lineWidth = 2;
  clearCanvas();

  // Clear pad screen + turn inking on (pad displays ink)
  await m_tablet.setClearScreen();
  await m_tablet.setInkingMode(p.InkingMode.InkingMode_On);

  // Start listening for pen reports
  const reportHandler = new WacomGSS.STU.ProtocolHelper.ReportHandler();

  const onPen = (r) => {
    m_penData.push(r);
    processPoint(r); // live preview on browser canvas
  };

  // Map the common pen report callbacks (like the demo)
  reportHandler.onReportPenData = onPen;
  reportHandler.onReportPenDataOption = onPen;
  reportHandler.onReportPenDataTimeCountSequence = onPen;

  await reportHandler.startReporting(m_tablet, true);

  console.log("✅ Signature capture started. Sign on the pad now.");
}

function exportSignatureImage() {
  // If you want JPEG like demo:
  // const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  const dataUrl = canvas.toDataURL("image/png"); // best for signatures
  document.getElementById("sigImg").src = dataUrl;
  return dataUrl; // base64 image to send to backend
}

async function clearSignature() {
  const p = new WacomGSS.STU.Protocol();
  m_penData = [];
  isDown = false;

  clearCanvas();

  if (m_tablet) {
    await m_tablet.setInkingMode(p.InkingMode.InkingMode_Off);
    await m_tablet.setClearScreen();
    await m_tablet.setInkingMode(p.InkingMode.InkingMode_On);
  }
}

async function finishSignatureCapture() {
  if (!m_tablet) return;

  const p = new WacomGSS.STU.Protocol();
  await m_tablet.setInkingMode(p.InkingMode.InkingMode_Off);

  const imgBase64 = exportSignatureImage();
  console.log("✅ Signature image ready (base64). Length:", imgBase64);

  // OPTIONAL: end capture / stop reporting (depends on your flow)
  // await m_tablet.endCapture();  // only if you used beginCapture() in your flow
}

// Buttons
document.getElementById("btnSign").addEventListener("click", async () => {
  try {
    await startSignatureCapture();
  } catch (e) {
    console.error("Start failed:", e);
  }
});

document.getElementById("btnFinish").addEventListener("click", async () => {
  try {
    await finishSignatureCapture();
  } catch (e) {
    console.error("Finish failed:", e);
  }
});

document.getElementById("btnClear").addEventListener("click", async () => {
  try {
    await clearSignature();
  } catch (e) {
    console.error("Clear failed:", e);
  }
});
