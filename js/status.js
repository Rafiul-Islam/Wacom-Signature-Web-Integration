// Updated to match the *official demoButtons* connection flow:
// - Wait for SigCaptX service
// - Ensure DCA is ready
// - Get USB devices
// - Create UsbInterface + connect(device, exclusive)
// - Create Tablet + Constructor(intf, encH, encH2)
// - Then you can call tablet.getCapability(), setClearScreen(), etc.

var m_tablet = null;
var m_intf = null;
var m_usbDevices = null;

const MAXRETRIES = 20;
const TIMEOUT_LONG = 1000;
const TIMEOUT_SHORT = 500;

class DCANotReady extends Error {}

function waitForServiceReady(retry = 0) {
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (WacomGSS?.STU?.isServiceReady && WacomGSS.STU.isServiceReady()) {
        return resolve(true);
      }
      if (retry >= MAXRETRIES)
        return reject(new Error("SigCaptX service not ready"));
      retry++;
      setTimeout(tick, TIMEOUT_LONG);
    };
    setTimeout(tick, TIMEOUT_SHORT);
  });
}

async function connectPad() {
  console.log("1) Checking SigCaptX service...");

  try {
    // 1) Wait for SigCaptX Web Service (websocket bridge)
    await waitForServiceReady();
    console.log("2) SigCaptX service: ready");

    // 2) Make sure Device Control App (DCA) is ready (same as demo)
    const dcaReady = await WacomGSS.STU.isDCAReady();
    if (!dcaReady) throw new DCANotReady("Device Control App not ready");
    console.log("3) DCA: ready");

    // 3) List USB devices
    m_usbDevices = await WacomGSS.STU.getUsbDevices();
    if (!m_usbDevices || m_usbDevices.length === 0) {
      throw new Error("No STU devices found");
    }
    console.log("4) Device found:", m_usbDevices[0]);

    // (Optional) check supported device (demo does this)
    const supported = await WacomGSS.STU.isSupportedUsbDevice(
      m_usbDevices[0].idVendor,
      m_usbDevices[0].idProduct,
    );
    if (!supported)
      throw new Error("Connected USB device is not a supported STU device");

    // 4) Create + construct USB interface, connect to first device
    m_intf = new WacomGSS.STU.UsbInterface();
    await m_intf.Constructor();
    await m_intf.connect(m_usbDevices[0], true); // true = exclusive
    console.log("5) USB interface connected");

    // 5) Create + construct Tablet using the interface
    // encH / encH2 are optional encryption handlers; demo passes undefined
    m_tablet = new WacomGSS.STU.Tablet();
    await m_tablet.Constructor(m_intf, undefined, undefined);
    console.log("6) Tablet constructed");

    // Once tablet is constructed, you can release interface reference like demo
    m_intf = null;

    // 6) Test calls
    const cap = await m_tablet.getCapability();
    console.log(
      `✅ SUCCESS: STU Ready: ${cap.screenWidth}x${cap.screenHeight}`,
    );

    // Clear screen (demo uses setClearScreen, not clrScreen)
    await m_tablet.setClearScreen();
    console.log("7) Cleared screen");
  } catch (error) {
    console.error("❌ Connection Failed:", error);

    if (error instanceof DCANotReady) {
      // same recovery idea as demo: reinit and try again
      console.log("Reinitializing STU...");
      try {
        WacomGSS.STU.Reinitialize();
      } catch (_) {}
      setTimeout(connectPad, TIMEOUT_LONG);
      return;
    }

    console.log(
      "Check: SigCaptX service running + PortCheck.html sample works.",
    );
  }
}

// Good practice: close SigCaptX bridge on tab close (demo does this)
window.addEventListener("beforeunload", () => {
  try {
    WacomGSS.STU.close();
  } catch (_) {}
});

window.onload = () => setTimeout(connectPad, 800);
