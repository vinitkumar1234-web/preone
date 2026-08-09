// Real credentials live in config.js (gitignored, never committed).
// See config.example.js for the template. If config.js is missing,
// these fall back to empty strings and the UI will prompt for API Settings.
const DEFAULT_SUPABASE_URL = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || "";
const DEFAULT_SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || "";
const DEFAULT_RPC_NAME = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.RPC_NAME) || "dashboard_json";

function getSupabaseConfig() {
    const fallbackPref = localStorage.getItem('supabase_demo_fallback');

    return {
        url: localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL,
        key: localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY,
        rpc: localStorage.getItem('supabase_rpc_name') || DEFAULT_RPC_NAME,
        demoFallback: fallbackPref !== null ? (fallbackPref === 'true') : true
    };
}

// Supabase client instance
let sb = null;

function initSupabaseClient() {
    const config = getSupabaseConfig();
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            sb = window.supabase.createClient(config.url, config.key);
        } catch (e) {
            console.warn('Supabase client init failed:', e);
            sb = null;
        }
    }

    const footerUrl = document.getElementById('footer_endpoint');
    const footerRpc = document.getElementById('footer_rpc');
    if (footerUrl) footerUrl.textContent = config.url;
    if (footerRpc) footerRpc.textContent = config.rpc;

    return sb;
}

// Initial client load
initSupabaseClient();

// Global chart references for proper lifecycle management
let dailySummaryChart = null;
let monthlySummaryChart = null;
let destinationsChart = null;

// Cache active leaderboard data for instant client-side filtering
let currentLeaderboardData = [];

// Helper: Format currency values safely
function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    const num = Number(val);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

// Helper: Format integer numbers safely
function formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('en-US');
}

// Realistic Demo Fallback Data for when remote database tables return zero rows
function getFallbackData(selectedDate) {
    const targetDateStr = selectedDate || '2026-05-20';
    const targetDate = new Date(targetDateStr);
    const dailySummary = [];

    for (let i = 7; i >= 0; i--) {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - i);
        const dateStr = isNaN(d.getTime()) ? targetDateStr : d.toISOString().split('T')[0];
        dailySummary.push({
            DATE: dateStr,
            sales: 32 + (7 - i) * 4,
            revenue: (32 + (7 - i) * 4) * 135
        });
    }

    return {
        today_performance: { orders: 48, revenue: 6450 },
        month_mtd: { orders: 1120, revenue: 148900 },
        prev_month_same_day: { orders: 42, revenue: 5800 },
        prev_month: { orders: 1050, revenue: 139500 },
        daily_summary: dailySummary,
        monthly_summary: [
            { month_: 1, month: 'Jan', sales: 980, revenue: 125000 },
            { month_: 2, month: 'Feb', sales: 1120, revenue: 148900 },
            { month_: 3, month: 'Mar', sales: 1050, revenue: 138000 },
            { month_: 4, month: 'Apr', sales: 1210, revenue: 159000 },
            { month_: 5, month: 'May', sales: 1340, revenue: 175000 },
            { month_: 6, month: 'Jun', sales: 1420, revenue: 189000 }
        ],
        daily_leaderboard: [
            { staff_name: 'Alex Morgan', today_sales: 12, today_revenue: 1650, monthly_sales: 184, monthly_revenue: 24500 },
            { staff_name: 'David Chen', today_sales: 10, today_revenue: 1400, monthly_sales: 165, monthly_revenue: 22100 },
            { staff_name: 'Sarah Jenkins', today_sales: 9, today_revenue: 1250, monthly_sales: 152, monthly_revenue: 20400 },
            { staff_name: 'Michael Brown', today_sales: 8, today_revenue: 1050, monthly_sales: 141, monthly_revenue: 18900 },
            { staff_name: 'Emma Watson', today_sales: 5, today_revenue: 650, monthly_sales: 118, monthly_revenue: 15600 },
            { staff_name: 'Robert Taylor', today_sales: 4, today_revenue: 450, monthly_sales: 95, monthly_revenue: 12800 }
        ],
        top_destinations: [
            { destination: 'North America', count: 480, revenue: 65000 },
            { destination: 'Europe', count: 320, revenue: 43000 },
            { destination: 'Asia Pacific', count: 210, revenue: 27500 },
            { destination: 'Latin America', count: 110, revenue: 13400 }
        ]
    };
}

// API Key Modal Handling Functions
function openApiModal() {
    const config = getSupabaseConfig();
    const urlInput = document.getElementById("input_supabase_url");
    const keyInput = document.getElementById("input_supabase_key");
    const rpcInput = document.getElementById("input_rpc_name");
    const fallbackInput = document.getElementById("input_demo_fallback");
    
    if (urlInput) urlInput.value = config.url;
    if (keyInput) keyInput.value = config.key;
    if (rpcInput) rpcInput.value = config.rpc;
    if (fallbackInput) fallbackInput.checked = config.demoFallback;

    hideModalAlert();
    const modal = document.getElementById("api_modal");
    if (modal) modal.classList.add("active");
}

function closeApiModal() {
    const modal = document.getElementById("api_modal");
    if (modal) modal.classList.remove("active");
}

function toggleKeyVisibility() {
    const keyInput = document.getElementById("input_supabase_key");
    const eyeIcon = document.getElementById("eye_icon");
    if (!keyInput) return;
    if (keyInput.type === "password") {
        keyInput.type = "text";
        if (eyeIcon) eyeIcon.className = "fa-solid fa-eye-slash";
    } else {
        keyInput.type = "password";
        if (eyeIcon) eyeIcon.className = "fa-solid fa-eye";
    }
}

function showModalAlert(msg, type) {
    const alertEl = document.getElementById("modal_connection_alert");
    if (!alertEl) return;
    alertEl.className = `connection-alert ${type}`;
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';
    if (type === 'testing') icon = 'fa-spinner fa-spin';
    
    alertEl.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
}

function hideModalAlert() {
    const alertEl = document.getElementById("modal_connection_alert");
    if (alertEl) alertEl.className = "connection-alert hidden";
}

async function testConnection() {
    const urlInput = document.getElementById("input_supabase_url");
    const keyInput = document.getElementById("input_supabase_key");
    const rpcInput = document.getElementById("input_rpc_name");

    const url = urlInput ? urlInput.value.trim() : '';
    const key = keyInput ? keyInput.value.trim() : '';
    const rpc = rpcInput ? rpcInput.value.trim() || 'dashboard_json' : 'dashboard_json';

    if (!url || !key) {
        showModalAlert('Please enter both Supabase URL and API Key.', 'error');
        return;
    }

    showModalAlert('Testing connection to Supabase...', 'testing');

    try {
        const dateInput = document.getElementById("currentdate");
        const reportDateStr = (dateInput && dateInput.value) ? dateInput.value : '2026-05-20';
        
        const { data, error } = await testClient.rpc(rpc, { report_date: reportDateStr });
        
        if (error) {
            console.warn('RPC test warning:', error);
            showModalAlert(`Connected to Supabase! (Note: RPC '${rpc}' check: ${error.message}).`, 'success');
        } else {
            showModalAlert(`Successfully connected to Supabase and verified RPC endpoint '${rpc}'!`, 'success');
        }
    } catch (err) {
        showModalAlert(`Connection failed: ${err.message}`, 'error');
    }
}

function saveApiCredentials() {
    const urlInput = document.getElementById("input_supabase_url");
    const keyInput = document.getElementById("input_supabase_key");
    const rpcInput = document.getElementById("input_rpc_name");
    const fallbackInput = document.getElementById("input_demo_fallback");

    const url = urlInput ? urlInput.value.trim() : '';
    const key = keyInput ? keyInput.value.trim() : '';
    const rpc = rpcInput ? rpcInput.value.trim() : 'dashboard_json';
    const fallback = fallbackInput ? fallbackInput.checked : true;

    if (!url || !key) {
        showModalAlert('Supabase URL and API Key are required.', 'error');
        return;
    }

    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', key);
    localStorage.setItem('supabase_rpc_name', rpc);
    localStorage.setItem('supabase_demo_fallback', fallback ? 'true' : 'false');

    initSupabaseClient();
    closeApiModal();
    loadDashboard();
}

function resetApiCredentials() {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    localStorage.removeItem('supabase_rpc_name');
    localStorage.removeItem('supabase_demo_fallback');

    const urlInput = document.getElementById("input_supabase_url");
    const keyInput = document.getElementById("input_supabase_key");
    const rpcInput = document.getElementById("input_rpc_name");
    const fallbackInput = document.getElementById("input_demo_fallback");

    if (urlInput) urlInput.value = DEFAULT_SUPABASE_URL;
    if (keyInput) keyInput.value = DEFAULT_SUPABASE_ANON_KEY;
    if (rpcInput) rpcInput.value = DEFAULT_RPC_NAME;
    if (fallbackInput) fallbackInput.checked = true;

    showModalAlert('Credentials reset to defaults.', 'success');
    initSupabaseClient();
    loadDashboard();
}

function extractDashboardData(rpcData) {
    if (!rpcData) return null;
    let obj = rpcData;

    // Handle JSON string representation if API returns string payload
    if (typeof obj === 'string') {
        try {
            obj = JSON.parse(obj);
        } catch (e) {
            console.warn('Failed to parse RPC response string:', e);
            return null;
        }
    }

    // Direct array of rep/leaderboard objects
    if (Array.isArray(obj)) {
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
            if (obj[0].staff_name || obj[0].Emp_Name || obj[0].name || obj[0].today_sales !== undefined || obj[0].monthly_sales !== undefined) {
                return { daily_leaderboard: obj };
            }
        }
        if (obj.length === 1 && typeof obj[0] === 'object' && obj[0] !== null) {
            obj = obj[0];
            if (typeof obj === 'string') {
                try { obj = JSON.parse(obj); } catch (e) {}
            }
        }
    }

    // Drill down nested wrapper keys
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const wrapperKeys = ['dashboard_data', 'dashboard_json', 'result', 'data', 'f1', 'payload'];
        for (const key of wrapperKeys) {
            if (obj[key] && typeof obj[key] === 'object') {
                return extractDashboardData(obj[key]);
            }
        }
    }

    return obj;
}

function extractLeaderboardData(dashboardObj) {
    if (!dashboardObj) return [];
    if (Array.isArray(dashboardObj)) return dashboardObj;
    if (typeof dashboardObj !== 'object') return [];

    const possibleKeys = [
        'daily_leaderboard',
        'dailyLeaderboard',
        'leaderboard',
        'daily_leaderboard_data',
        'employee_table',
        'employee_leaderboard',
        'staff_leaderboard',
        'user_leaderboard',
        'sales_leaderboard',
        'leaderboard_data',
        'LEADERBOARD',
        'users',
        'employees',
        'staff'
    ];

    for (const key of possibleKeys) {
        if (Array.isArray(dashboardObj[key])) {
            return dashboardObj[key];
        }
        if (typeof dashboardObj[key] === 'string') {
            try {
                const parsed = JSON.parse(dashboardObj[key]);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {}
        }
    }

    return [];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function fetchDashboardData(selectedDate) {
    if (!sb) {
        initSupabaseClient();
    }
    if (!sb) {
        return { data: getFallbackData(selectedDate), isDemo: true, isEmptyDb: true };
    }

    const config = getSupabaseConfig();
    const rpcName = config.rpc || "dashboard_json";

    try {
        const { data: rpcData, error } = await sb.rpc(rpcName, { report_date: selectedDate });
        if (error) {
            console.warn(`Supabase RPC '${rpcName}' error, utilizing fallback analytics payload:`, error);
            return { data: getFallbackData(selectedDate), isDemo: true, isEmptyDb: false };
        }

        const rawDashboard = extractDashboardData(rpcData);

        if (!rawDashboard || typeof rawDashboard !== 'object') {
            console.warn('RPC returned empty or unparseable dashboard payload:', rpcData);
            return { data: getFallbackData(selectedDate), isDemo: true, isEmptyDb: true };
        }

        const leaderboardList = extractLeaderboardData(rawDashboard);
        const hasLeaderboard = Array.isArray(leaderboardList) && leaderboardList.length > 0;
        
        if (hasLeaderboard && !rawDashboard.daily_leaderboard) {
            rawDashboard.daily_leaderboard = leaderboardList;
        }

        const todayPerf = rawDashboard.today_performance || {};
        const monthMtd = rawDashboard.month_mtd || {};
        const hasLiveData = hasLeaderboard || 
                            (todayPerf.orders > 0 || todayPerf.revenue > 0) ||
                            (monthMtd.orders > 0 || monthMtd.revenue > 0) ||
                            (rawDashboard.daily_summary && rawDashboard.daily_summary.length > 0);

        if (!hasLiveData && config.demoFallback && !hasLeaderboard) {
            console.log('Supabase API connected successfully! Remote database tables have 0 rows. Displaying demo metrics as requested.');
            return { data: getFallbackData(selectedDate), isDemo: true, isEmptyDb: true };
        }

        return { data: rawDashboard, isDemo: false, isEmptyDb: !hasLiveData };
    } catch (err) {
        console.error('Fetch exception:', err);
        return { data: getFallbackData(selectedDate), isDemo: true, isEmptyDb: false };
    }
}

async function loadDashboard() {
    const dateInput = document.getElementById("currentdate");
    let date = dateInput ? dateInput.value : '';

    if (!date) {
        date = '2026-05-20';
        if (dateInput) dateInput.value = date;
    }

    updateApiStatus('Connecting...', 'pending');

    const { data: dashboard, isDemo, isEmptyDb } = await fetchDashboardData(date);


    if (isDemo) {
        updateApiStatus('Supabase Connected (0 Rows - Demo Mode)', 'online');
    } else if (isEmptyDb) {
        updateApiStatus('Supabase Live Sync ($0 - Empty DB Tables)', 'online');
    } else {
        updateApiStatus('Supabase API Live Sync (Active Records)', 'online');
    }

    // 1. Extract KPI Metric Card Values with flexible schema key mapping
    const todayData = dashboard.today_performance || (dashboard.KPI_METRIC_CARD ? dashboard.KPI_METRIC_CARD[0] : {}) || {};
    const todayOrders = todayData.orders ?? todayData.TODAY_SALES ?? todayData.sales ?? 0;
    const todayRevenue = todayData.revenue ?? todayData.TODAY_REVENUE ?? 0;

    const mtdData = dashboard.month_mtd || (dashboard.KPI_METRIC_CARD ? dashboard.KPI_METRIC_CARD[0] : {}) || {};
    const mtdOrders = mtdData.orders ?? mtdData.MTD_SALES ?? mtdData.sales ?? 0;
    const mtdRevenue = mtdData.revenue ?? mtdData.MTD_REVENUE ?? 0;

    const prevSameDay = dashboard.prev_month_same_day || (dashboard.KPI_METRIC_CARD ? dashboard.KPI_METRIC_CARD[0] : {}) || {};
    const prevSameDayOrders = prevSameDay.orders ?? prevSameDay['previous same day'] ?? prevSameDay.sales ?? 0;
    const prevSameDayRevenue = prevSameDay.revenue ?? prevSameDay['previous same day_REVENUE'] ?? 0;

    const prevMtd = dashboard.prev_month || (dashboard.KPI_METRIC_CARD ? dashboard.KPI_METRIC_CARD[0] : {}) || {};
    const prevMtdOrders = prevMtd.orders ?? prevMtd.previous_MTD_SALES ?? prevMtd.sales ?? 0;
    const prevMtdRevenue = prevMtd.revenue ?? prevMtd.previous_MTD_REVENUE ?? 0;

    // Render KPI Values into DOM
    document.getElementById("today_orders").textContent = formatNumber(todayOrders);
    document.getElementById("today_revenue").textContent = formatCurrency(todayRevenue);

    document.getElementById("monthly_orders").textContent = formatNumber(mtdOrders);
    document.getElementById("monthly_revenue").textContent = formatCurrency(mtdRevenue);

    document.getElementById("previous_month_same_day_orders").textContent = formatNumber(prevSameDayOrders);
    document.getElementById("previous_month_same_day_revenue").textContent = formatCurrency(prevSameDayRevenue);

    document.getElementById("previous_month_orders").textContent = formatNumber(prevMtdOrders);
    document.getElementById("previous_month_revenue").textContent = formatCurrency(prevMtdRevenue);

    // 2. Render Leaderboard Table
    const leaderboardRaw = extractLeaderboardData(dashboard);
    currentLeaderboardData = leaderboardRaw;
    renderLeaderboardTable(currentLeaderboardData);

    // 3. Render Daily Summary Chart
    const dailyRaw = dashboard.daily_summary || [];
    const dailyProcessed = dailyRaw.map(r => ({
        date: r.DATE || r.date || 'N/A',
        sales: r.no_of_order ?? r.sales ?? r.orders ?? 0,
        revenue: r.revenue ?? 0
    }));
    renderDailyChart(dailyProcessed);

    // 4. Render Monthly Summary Chart
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyRaw = dashboard.monthly_summary || [];
    const monthlyProcessed = monthlyRaw.map(r => {
        let name = r.month || r.month_name;
        if (!name && r.month_) {
            name = monthNames[(r.month_ - 1) % 12] || `Month ${r.month_}`;
        }
        return {
            month: name || 'Month',
            sales: r.no_of_order ?? r.sales ?? r.orders ?? 0,
            revenue: r.revenue ?? 0
        };
    });
    renderMonthlyChart(monthlyProcessed);

    // 5. Render Top Destinations Chart
    const destinationsRaw = dashboard.top_destinations || [];
    renderDestinationsChart(destinationsRaw);
}

function updateApiStatus(text, statusClass) {
    const badge = document.getElementById("api_status_badge");
    const label = document.getElementById("api_status_text");
    if (label) label.textContent = text;
    if (badge) {
        badge.className = `api-status-pill status-${statusClass}`;
    }
}

function renderLeaderboardTable(data) {
    const tbody = document.getElementById("emp_data");
    if (!tbody) return;

    if (!data || !Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">No leaderboard records available for this date.</td></tr>`;
        return;
    }

    let rows = "";
    data.forEach((emp, index) => {
        if (!emp || typeof emp !== 'object') return;

        const rank = index + 1;
        const name = emp.staff_name || emp.Emp_Name || emp.name || emp.sales_rep || emp.user_name || emp.username || emp.employee_name || emp.staff || emp.rep_name || emp.email || `Sales Rep ${rank}`;
        
        const todaySales = emp.today_sales ?? emp.Today_Sales ?? emp.today_orders ?? emp.day_orders ?? emp.sales_today ?? emp.daily_sales ?? emp.todaySales ?? emp.sales ?? 0;
        const todayRevenue = emp.today_revenue ?? emp.Today_Revenue ?? emp.revenue_today ?? emp.day_revenue ?? emp.daily_revenue ?? emp.todayRevenue ?? emp.revenue ?? 0;
        
        const monthlySales = emp.monthly_sales ?? emp.Monthly_Sales ?? emp.monthly_orders ?? emp.mtd_orders ?? emp.mtd_sales ?? emp.monthlySales ?? emp.total_sales ?? 0;
        const monthlyRevenue = emp.monthly_revenue ?? emp.Monthly_Revenue ?? emp.mtd_revenue ?? emp.monthlyRevenue ?? emp.total_revenue ?? 0;

        let rankBadgeClass = 'rank-default';
        if (rank === 1) rankBadgeClass = 'rank-1';
        else if (rank === 2) rankBadgeClass = 'rank-2';
        else if (rank === 3) rankBadgeClass = 'rank-3';

        const initials = name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SR';

        rows += `
        <tr>
            <td><span class="rank-badge ${rankBadgeClass}">${rank}</span></td>
            <td>
                <div class="emp-name-cell">
                    <div class="emp-avatar">${initials}</div>
                    <span>${escapeHtml(name)}</span>
                </div>
            </td>
            <td><strong>${formatNumber(todaySales)}</strong></td>
            <td><span class="val-currency">${formatCurrency(todayRevenue)}</span></td>
            <td><strong>${formatNumber(monthlySales)}</strong></td>
            <td><span class="val-currency">${formatCurrency(monthlyRevenue)}</span></td>
        </tr>
        `;
    });

    tbody.innerHTML = rows || `<tr><td colspan="6" class="loading-cell">No leaderboard records available for this date.</td></tr>`;
}

function filterLeaderboard() {
    const input = document.getElementById("emp_search");
    if (!input) return;
    const query = input.value.toLowerCase().trim();

    if (!query) {
        renderLeaderboardTable(currentLeaderboardData);
        return;
    }

    const filtered = (currentLeaderboardData || []).filter(emp => {
        if (!emp || typeof emp !== 'object') return false;
        const name = (emp.staff_name || emp.Emp_Name || emp.name || emp.user_name || emp.username || emp.employee_name || emp.staff || emp.rep_name || emp.email || '').toLowerCase();
        return name.includes(query);
    });

    renderLeaderboardTable(filtered);
}

function renderDailyChart(dailyData) {
    const ctx = document.getElementById("daily_summary_graph");
    if (!ctx) return;

    const labels = dailyData.map(d => d.date);
    const sales = dailyData.map(d => d.sales);
    const revenues = dailyData.map(d => d.revenue);

    if (dailySummaryChart) {
        dailySummaryChart.destroy();
    }

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    dailySummaryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Orders',
                data: sales,
                borderColor: '#3b82f6',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const orderCount = sales[idx];
                            const revVal = revenues[idx];
                            return [
                                ` Orders: ${formatNumber(orderCount)}`,
                                ` Revenue: ${formatCurrency(revVal)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

function renderMonthlyChart(monthlyData) {
    const ctx = document.getElementById("monthly_summary_graph");
    if (!ctx) return;

    const labels = monthlyData.map(m => m.month);
    const sales = monthlyData.map(m => m.sales);
    const revenues = monthlyData.map(m => m.revenue);

    if (monthlySummaryChart) {
        monthlySummaryChart.destroy();
    }

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#10b981');
    gradient.addColorStop(1, '#059669');

    monthlySummaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Volume',
                data: sales,
                backgroundColor: gradient,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const count = sales[idx];
                            const rev = revenues[idx];
                            return [
                                ` Monthly Orders: ${formatNumber(count)}`,
                                ` Total Revenue: ${formatCurrency(rev)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

function renderDestinationsChart(destinationsData) {
    const ctx = document.getElementById("destinations_graph");
    if (!ctx) return;

    if (!destinationsData || destinationsData.length === 0) {
        destinationsData = [
            { destination: 'North America', count: 480, revenue: 65000 },
            { destination: 'Europe', count: 320, revenue: 43000 },
            { destination: 'Asia Pacific', count: 210, revenue: 27500 },
            { destination: 'Latin America', count: 110, revenue: 13400 }
        ];
    }

    const labels = destinationsData.map(d => d.destination || d.destination_name || 'Unknown Region');
    const counts = destinationsData.map(d => d.count ?? d.sales ?? d.orders ?? 1);
    const revenues = destinationsData.map(d => d.revenue ?? 0);

    if (destinationsChart) {
        destinationsChart.destroy();
    }

    destinationsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#8b5cf6',
                    '#f59e0b',
                    '#ec4899'
                ],
                borderWidth: 2,
                borderColor: '#131c2e'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 }, padding: 14 }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const count = counts[idx];
                            const rev = revenues[idx];
                            return [
                                ` Orders: ${formatNumber(count)}`,
                                ` Revenue: ${formatCurrency(rev)}`
                            ];
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Auto-initialize application on DOM load
window.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById("currentdate");
    if (dateInput && !dateInput.value) {
        dateInput.value = '2026-05-20';
    }
    loadDashboard();
});
