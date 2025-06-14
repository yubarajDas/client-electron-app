const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let throughputChart, packetChart;
let labels = [], txThroughputData = [], rxThroughputData = [], packetCountData = [];
let fetchInterval = null;
let clientProcess = null;

const jsonPath = path.resolve("C:/Users/Yubaraj/tatacomm-remoteus-Multi-Client-and-Optimizations/mpquic_client/windowsbuild/bin/Debug/mpquic_live_stats.json");
const clientExePath = "C:\\Users\\Yubaraj\\tatacomm-remoteus-Multi-Client-and-Optimizations\\mpquic_client\\windowsbuild\\bin\\Debug";

// Starts periodic JSON reading
function fetchAndUpdate() {
  fs.readFile(jsonPath, 'utf8', (err, jsonString) => {
    if (err) {
      console.error("File read error:", err);
      return;
    }

    try {
      const data = JSON.parse(jsonString.trim());
      updateDOM(data);
      updateCharts(data);
      showToast("Data refreshed");
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
}


// Keep track of previous data to compare changes
let previousData = null;

function updateDOM(data) {
  const $ = (id) => document.getElementById(id);
  if (!data) return;





  // Only update DOM elements if the value has changed
  function updateIfChanged(elementId, newValue, formatter = (val) => val) {
    if (!previousData || 
        JSON.stringify(getNestedValue(previousData, elementId)) !== JSON.stringify(newValue)) {
      $(elementId).innerText = formatter(newValue);
    }
  }





  // Helper to get nested values using the same path as element IDs
  function getNestedValue(obj, path) {
    switch(path) {
      case 'timestamp': return obj.timestamp;
      case 'session-duration': return obj.running_time_seconds;
      case 'server-ip': return obj.session.server;
      case 'server-port': return obj.session.port;
      case 'tx-windivert': return obj.packet_statistics.transmit.windivert_packets;
      case 'tx-mpquic': return obj.packet_statistics.transmit.mpquic_packets;
      case 'tx-bytes': return obj.packet_statistics.transmit.bytes;
      case 'tx-throughput': return obj.packet_statistics.transmit.current_throughput_kbps;
      case 'rx-windivert': return obj.packet_statistics.receive.windivert_packets;
      case 'rx-mpquic': return obj.packet_statistics.receive.mpquic_packets;
      case 'rx-bytes': return obj.packet_statistics.receive.bytes;
      case 'rx-throughput': return obj.packet_statistics.receive.current_throughput_kbps;
      case 'packet-loss-count': return obj.packet_statistics.reliability?.packet_loss_count;
      case 'packet-loss-rate': return obj.packet_statistics.reliability?.packet_loss_rate_percent;
      case 'retransmissions': return obj.packet_statistics.reliability?.retransmissions;
      default: return undefined;
    }
  }





  // Update only changed values
  updateIfChanged('timestamp', data.timestamp);
  updateIfChanged('session-duration', data.running_time_seconds, val => val + " sec");
  updateIfChanged('server-ip', data.session.server);
  updateIfChanged('server-port', data.session.port);






  updateIfChanged('tx-windivert', data.packet_statistics.transmit.windivert_packets);
  updateIfChanged('tx-mpquic', data.packet_statistics.transmit.mpquic_packets);
  updateIfChanged('tx-bytes', data.packet_statistics.transmit.bytes);
  updateIfChanged('tx-throughput', data.packet_statistics.transmit.current_throughput_kbps, val => `${val} kbps`);

  updateIfChanged('rx-windivert', data.packet_statistics.receive.windivert_packets);
  updateIfChanged('rx-mpquic', data.packet_statistics.receive.mpquic_packets);
  updateIfChanged('rx-bytes', data.packet_statistics.receive.bytes);
  updateIfChanged('rx-throughput', data.packet_statistics.receive.current_throughput_kbps, val => `${val} kbps`);

  updateIfChanged('packet-loss-count', data.packet_statistics.reliability?.packet_loss_count ?? "--");
  updateIfChanged('packet-loss-rate', data.packet_statistics.reliability?.packet_loss_rate_percent, 
    val => val ? val + " %" : "--");
  updateIfChanged('retransmissions', data.packet_statistics.reliability?.retransmissions ?? "--");

  // Store current data for next comparison
  previousData = JSON.parse(JSON.stringify(data));
}

function updateCharts(data) {
  const time = data.timestamp;
  if (labels.includes(time)) return;

  const tx = data.packet_statistics.transmit.current_throughput_kbps;
  const rx = data.packet_statistics.receive.current_throughput_kbps;

  labels.push(time);
  txThroughputData.push(tx);
  rxThroughputData.push(rx);
  packetCountData.push(
    data.packet_statistics.transmit.windivert_packets +
    data.packet_statistics.receive.windivert_packets
  );

  if (labels.length > 20) {
    labels.shift();
    txThroughputData.shift();
    rxThroughputData.shift();
    packetCountData.shift();
  }

  throughputChart.data.labels = [...labels];
  throughputChart.data.datasets[0].data = [...txThroughputData];
  throughputChart.data.datasets[1].data = [...rxThroughputData];
  throughputChart.update();

  packetChart.data.labels = [...labels];
  packetChart.data.datasets[0].data = [...packetCountData];
  packetChart.update();
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
    chart.options.plugins.legend.labels.color = textColor;
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    chart.update();
  });
}

function setupCharts() {
  const ctx1 = document.getElementById('throughputChart').getContext('2d');
  throughputChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Transmit Throughput (kbps)',
          data: [],
          borderColor: '#3a86ff',
          backgroundColor: 'rgba(58, 134, 255, 0.3)',
          tension: 0.3,
          fill: false,
          pointRadius: 3
        },
        {
          label: 'Receive Throughput (kbps)',
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

  const ctx2 = document.getElementById('packetChart').getContext('2d');
  packetChart = new Chart(ctx2, {
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

function showToast(message = "Updated!") {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 1500);
}

// Expose start/stop for Electron renderer process
window.startClient = startClient;
window.stopClient = stopClient;
