const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let throughputChart, packetChart;
let labels = [], txThroughputData = [], rxThroughputData = [], packetCountData = [];
let fetchInterval = null;
let clientProcess = null;

const jsonPath = path.resolve("C:/Users/Yubaraj/tatacomm-remoteus-Multi-Client-and-Optimizations/modularise_client/windowsbuild/bin/Debug/current_stats.json");
const clientExePath = "C:\\Users\\Yubaraj\\tatacomm-remoteus-Multi-Client-and-Optimizations\\modularise_client\\windowsbuild\\bin\\Debug";

// Starts periodic JSON reading
function fetchAndUpdate() {
  fs.readFile(jsonPath, 'utf8', (err, jsonString) => {
    if (err) {
      console.error("File read error:", err);
      return;
    }

    try {
      const data = JSON.parse(jsonString.trim());
      console.log(data);
      updateDOM(data);
      updateCharts(data);
      // showToast("Data refreshed");
    } catch (parseError) {
      console.error("JSON parse error:", parseError.message);
    }
  });
}

function startClient() {
  if (clientProcess) {
    console.log("Client is already running.");
    showToast("Client already running");
    return;
  }

  console.log("Starting client...");
  clientProcess = spawn("client.exe", ["data.json"], {
    cwd: clientExePath,
    shell: true,
    windowsHide: true
  });

  clientProcess.stdout.on('data', (data) => {
    console.log(`[stdout] ${data}`);
  });

  clientProcess.stderr.on('data', (data) => {
    console.error(`[stderr] ${data}`);
  });

  clientProcess.on('close', (code) => {
    console.log(`client.exe exited with code ${code}`);
    clientProcess = null;
    if (fetchInterval) {
      clearInterval(fetchInterval);
      fetchInterval = null;
    }
  });

  if (!throughputChart || !packetChart) setupCharts();

  // Start polling every 1 second
  if (!fetchInterval) {
    fetchInterval = setInterval(fetchAndUpdate, 1000);
  }
}

const { exec } = require('child_process');

function disconnectClient() {
    // Hide the main dashboard and show the start screen
    const mainDashboard = document.getElementById("main-dashboard");
    const startScreen = document.getElementById("start-screen");
    
    if (mainDashboard) mainDashboard.style.display = "none";
    if (startScreen) startScreen.style.display = "flex";

    // Command to stop the client.exe process
    exec('taskkill /F /IM client.exe', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping client.exe: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
}

function stopClient() {
  if (clientProcess && clientProcess.pid) {
    const { exec } = require('child_process');

    exec(`taskkill /PID ${clientProcess.pid} /T /F`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Failed to kill client process: ${err}`);
        return;
      }
      console.log("Client process terminated.");
      showToast("Client stopped");
    });

    clientProcess = null;
  } else {
    console.log("No client process running.");
    showToast("Nothing to stop");
  }

  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
  disconnectClient();
}

// Keep track of previous data to compare changes
let previousData = null;

function updateDOM(data) {
  const $ = (id) => document.getElementById(id);
  if (!data) return;

  // Only update DOM elements if the value has changed and element exists
  function updateIfChanged(elementId, newValue, formatter = (val) => val) {
    const element = $(elementId);
    if (!element) {
      console.warn(`Element with ID '${elementId}' not found in DOM`);
      return;
    }
    
    if (!previousData || 
        JSON.stringify(getNestedValue(previousData, elementId)) !== JSON.stringify(newValue)) {
      element.innerText = formatter(newValue);
    }
  }

  // Helper to get nested values using the new JSON structure
  function getNestedValue(obj, path) {
    switch(path) {
      case 'timestamp': return obj.session?.timestamp;
      case 'server-ip': return obj.session?.server;
      case 'server-port': return obj.session?.port;
      case 'tx-packets': return obj.tx_block?.Tx_pkts;
      case 'tx-current': return obj.tx_block?.Tx_current;
      case 'upload-bytes': return obj.tx_block?.Upload_bytes;
      case 'rx-packets': return obj.rx_block?.Rx_pkts;
      case 'rx-current': return obj.rx_block?.Rx_current;
      case 'download-bytes': return obj.rx_block?.Download_bytes;
      case 'packet-loss': return obj.loss_block?.packet_loss;
      default: return undefined;
    }
  }

  // Update session information
  if (data.session) {
    updateIfChanged('timestamp', data.session.timestamp);
    updateIfChanged('server-ip', data.session.server);
    updateIfChanged('server-port', data.session.port);
  }

  // Update TX block information
  if (data.tx_block) {
    updateIfChanged('tx-packets', data.tx_block.Tx_pkts);
    updateIfChanged('tx-current', data.tx_block.Tx_current);
    updateIfChanged('upload-bytes', data.tx_block.Upload_bytes, val => `${val.toLocaleString()} bytes`);
  }

  // Update RX block information
  if (data.rx_block) {
    updateIfChanged('rx-packets', data.rx_block.Rx_pkts);
    updateIfChanged('rx-current', data.rx_block.Rx_current);
    updateIfChanged('download-bytes', data.rx_block.Download_bytes, val => `${val.toLocaleString()} bytes`);
  }

  // Update loss block information
  if (data.loss_block) {
    updateIfChanged('packet-loss', data.loss_block.packet_loss);
  }

  // Store current data for next comparison
  previousData = JSON.parse(JSON.stringify(data));
}

function updateCharts(data) {
  if (!data.session?.timestamp) return;
  
  const time = data.session.timestamp;
  if (labels.includes(time)) return;

  const txCurrent = data.tx_block?.Tx_current || 0;
  const rxCurrent = data.rx_block?.Rx_current || 0;
  const totalPackets = (data.tx_block?.Tx_pkts || 0) + (data.rx_block?.Rx_pkts || 0);

  labels.push(time);
  txThroughputData.push(txCurrent);
  rxThroughputData.push(rxCurrent);
  packetCountData.push(totalPackets);

  if (labels.length > 20) {
    labels.shift();
    txThroughputData.shift();
    rxThroughputData.shift();
    packetCountData.shift();
  }

  if (throughputChart) {
    throughputChart.data.labels = [...labels];
    throughputChart.data.datasets[0].data = [...txThroughputData];
    throughputChart.data.datasets[1].data = [...rxThroughputData];
    throughputChart.update();
  }

  if (packetChart) {
    packetChart.data.labels = [...labels];
    packetChart.data.datasets[0].data = [...packetCountData];
    packetChart.update();
  }
}

function exportJSON() {
  const exportPath = path.join(__dirname, `stats_export_${Date.now()}.json`);
  fs.readFile(jsonPath, 'utf8', (err, jsonString) => {
    if (err) {
      console.error("Export read error:", err);
      return;
    }
    fs.writeFile(exportPath, jsonString, (err) => {
      if (err) {
        console.error("File write failed:", err);
      } else {
        console.log("Stats exported to", exportPath);
        showToast("Exported to file");
      }
    });
  });
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  updateChartColors();
}

function updateChartColors() {
  const textColor = getComputedStyle(document.body).color;
  [throughputChart, packetChart].forEach(chart => {
    if (chart) {
      chart.options.plugins.legend.labels.color = textColor;
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.y.ticks.color = textColor;
      chart.update();
    }
  });
}

function setupCharts() {
  const throughputCtx = document.getElementById('throughputChart');
  const packetCtx = document.getElementById('packetChart');

  if (throughputCtx) {
    throughputChart = new Chart(throughputCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'TX Current',
            data: [],
            borderColor: '#3a86ff',
            backgroundColor: 'rgba(58, 134, 255, 0.3)',
            tension: 0.3,
            fill: false,
            pointRadius: 3
          },
          {
            label: 'RX Current',
            data: [],
            borderColor: '#ff006e',
            backgroundColor: 'rgba(255, 0, 110, 0.3)',
            tension: 0.3,
            fill: false,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: getComputedStyle(document.body).color } } },
        scales: {
          x: { ticks: { color: getComputedStyle(document.body).color } },
          y: { beginAtZero: true, ticks: { color: getComputedStyle(document.body).color } }
        }
      }
    });
  }

  if (packetCtx) {
    packetChart = new Chart(packetCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Total Packet Count',
          data: [],
          backgroundColor: '#ff9f1c'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: getComputedStyle(document.body).color } } },
        scales: {
          x: { ticks: { color: getComputedStyle(document.body).color } },
          y: { beginAtZero: true, ticks: { color: getComputedStyle(document.body).color } }
        }
      }
    });
  }
}

function showToast(message = "Updated!") {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.innerText = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 1500);
  }
}

// Expose start/stop for Electron renderer process
window.startClient = startClient;
window.stopClient = stopClient;
