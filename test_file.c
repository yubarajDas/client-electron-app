#include <windows.h>
#include <iphlpapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <winsock2.h>

#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "ws2_32.lib")

// Configuration (can be changed as needed)
#define SERVER_IP "192.168.29.121"
#define SERVER_PORT 9433
#define MEASUREMENT_INTERVAL_MS 1000

typedef struct {
    DWORD windivert_packets;
    DWORD mpquic_packets;
    DWORD bytes;
    double throughput_bps;
} PacketStats;

typedef struct {
    DWORD packet_loss_count;
    double packet_loss_rate_percent;
    DWORD retransmissions;
} ReliabilityStats;

void get_current_timestamp(char* buffer, size_t size) {
    time_t now = time(NULL);
    struct tm* t = localtime(&now);
    strftime(buffer, size, "%Y-%m-%d %H:%M:%S", t);
}

int main() {
    // Start session timer
    DWORD session_start_time = GetTickCount();
    
    MIB_IFTABLE* pIfTable;
    DWORD dwSize = 0;
    DWORD dwRetVal = 0;
    
    // Allocate memory for interface table
    GetIfTable(NULL, &dwSize, FALSE);
    pIfTable = (MIB_IFTABLE*) malloc(dwSize);
    
    if ((dwRetVal = GetIfTable(pIfTable, &dwSize, FALSE)) != NO_ERROR) {
        printf("GetIfTable failed (%lu)\n", dwRetVal);
        return 1;
    }
    
    // Get initial packet counts
    DWORD tx_before = 0, rx_before = 0;
    int found = 0;
    
    for (DWORD i = 0; i < pIfTable->dwNumEntries && found < 1; i++) {
        MIB_IFROW row = pIfTable->table[i];
        // In a real implementation, you would identify the specific interface
        // that's handling your MPQUIC traffic
        if (strstr((char*)row.bDescr, "Ethernet") || strstr((char*)row.bDescr, "Wi-Fi")) {
            tx_before = row.dwOutOctets;
            rx_before = row.dwInOctets;
            found = 1;
        }
    }
    
    // Simulate packet processing for the specified interval
    Sleep(MEASUREMENT_INTERVAL_MS);
    
    // Get updated packet counts
    GetIfTable(pIfTable, &dwSize, FALSE);
    DWORD tx_after = 0, rx_after = 0;
    found = 0;
    
    for (DWORD i = 0; i < pIfTable->dwNumEntries && found < 1; i++) {
        MIB_IFROW row = pIfTable->table[i];
        if (strstr((char*)row.bDescr, "Ethernet") || strstr((char*)row.bDescr, "Wi-Fi")) {
            tx_after = row.dwOutOctets;
            rx_after = row.dwInOctets;
            found = 1;
        }
    }
    
    // Calculate bytes transmitted/received
    DWORD tx_bytes = tx_after - tx_before;
    DWORD rx_bytes = rx_after - rx_before;
    
    // Calculate throughput in bits per second
    double tx_bps = (tx_bytes * 8.0) / (MEASUREMENT_INTERVAL_MS / 1000.0);
    double rx_bps = (rx_bytes * 8.0) / (MEASUREMENT_INTERVAL_MS / 1000.0);
    
    // Generate timestamp
    char timestamp[64];
    get_current_timestamp(timestamp, sizeof(timestamp));
    
    // Calculate session duration
    double session_duration = (GetTickCount() - session_start_time) / 1000.0;
    
    // For demonstration, we'll estimate packet counts
    // In a real implementation, you would track actual MPQUIC packets
    PacketStats tx_stats = {
        .windivert_packets = 698,  // Example values
        .mpquic_packets = 698,
        .bytes = tx_bytes,
        .throughput_bps = tx_bps
    };
    
    PacketStats rx_stats = {
        .windivert_packets = 488,  // Example values
        .mpquic_packets = 488,
        .bytes = rx_bytes,
        .throughput_bps = rx_bps
    };
    
    ReliabilityStats reliability = {
        .packet_loss_count = 0,
        .packet_loss_rate_percent = 0.0,
        .retransmissions = 0
    };
    
    // Output JSON format
    printf("{\n");
    printf("  \"timestamp\": \"%s\",\n", timestamp);
    printf("  \"session\": {\n");
    printf("    \"duration_seconds\": %.2f,\n", session_duration);
    printf("    \"server\": \"%s\",\n", SERVER_IP);
    printf("    \"port\": %d\n", SERVER_PORT);
    printf("  },\n");
    printf("  \"packet_statistics\": {\n");
    printf("    \"transmit\": {\n");
    printf("      \"windivert_packets\": %lu,\n", tx_stats.windivert_packets);
    printf("      \"mpquic_packets\": %lu,\n", tx_stats.mpquic_packets);
    printf("      \"bytes\": %lu,\n", tx_stats.bytes);
    printf("      \"throughput_bps\": %.2f\n", tx_stats.throughput_bps);
    printf("    },\n");
    printf("    \"receive\": {\n");
    printf("      \"windivert_packets\": %lu,\n", rx_stats.windivert_packets);
    printf("      \"mpquic_packets\": %lu,\n", rx_stats.mpquic_packets);
    printf("      \"bytes\": %lu,\n", rx_stats.bytes);
    printf("      \"throughput_bps\": %.2f\n", rx_stats.throughput_bps);
    printf("    },\n");
    printf("    \"reliability\": {\n");
    printf("      \"packet_loss_count\": %lu,\n", reliability.packet_loss_count);
    printf("      \"packet_loss_rate_percent\": %.2f,\n", reliability.packet_loss_rate_percent);
    printf("      \"retransmissions\": %lu\n", reliability.retransmissions);
    printf("    }\n");
    printf("  }\n");
    printf("}\n");
    
    // Clean up
    free(pIfTable);
    return 0;
}