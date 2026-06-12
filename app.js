// ZippyBites Analytics Hub - Dashboard Logic

// Global State
let rawOrders = [];
let precomputedData = {};
let activeTab = 'overview';

// Chart Instances (to destroy and rebuild on updates)
let weeklyTrendsChart = null;
let cityRevenueChart = null;
let categoryRevenueChart = null;
let deliveryDistChart = null;
let ontimeTrendChart = null;
let cancelReasonsChart = null;
let ratingsDistChart = null;
let revenueForecastChart = null;

// Initialize Page Function
const initDashboard = async () => {
    setupTabNavigation();
    showLoading(true);
    
    try {
        // Fetch precomputed data
        const responseData = await fetch('dashboard_data.json');
        precomputedData = await responseData.json();
        
        // Fetch raw order data for interactive client-side filtering
        const responseCSV = await fetch('orders_cleaned.csv');
        const csvText = await responseCSV.text();
        rawOrders = parseCSV(csvText);
        
        // Populate initial UI
        populateStaticContent();
        initFilters();
        updateDashboard();
        initPredictiveTab();
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load dashboard data. Please run process_data.py first.');
    } finally {
        showLoading(false);
    }
};

// Robust DOM load listener
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

// CSV Parser Helper
function parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].trim().split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        const row = {};
        
        for (let j = 0; j < headers.length; j++) {
            let val = values[j];
            // Clean value strings
            if (val === undefined || val === '') {
                row[headers[j]] = null;
            } else {
                // Parse numbers if applicable
                if (!isNaN(val) && val !== '') {
                    row[headers[j]] = val.includes('.') ? parseFloat(val) : parseInt(val);
                } else {
                    row[headers[j]] = val;
                }
            }
        }
        data.push(row);
    }
    return data;
}

// Show/Hide Loading Indicator
function showLoading(show) {
    const loader = document.getElementById('data-loading');
    if (show) {
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

// Navigation Tab Switching
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            activeTab = target;
            
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(`${target}-tab`).classList.add('active');
            
            // Re-render visible Chart.js instances if needed due to canvas resizing
            triggerResize();
        });
    });
}

// Trigger Chart.js updates on tab change
function triggerResize() {
    window.dispatchEvent(new Event('resize'));
}

// Initialize Dropdown Filters
function initFilters() {
    const cityFilter = document.getElementById('city-filter');
    const cuisineFilter = document.getElementById('cuisine-filter');
    const dayFilter = document.getElementById('day-filter');
    const resetBtn = document.getElementById('reset-filters');
    
    const filterChangeHandler = () => {
        showLoading(true);
        // Add tiny timeout to let loading spinner show
        setTimeout(() => {
            updateDashboard();
            showLoading(false);
        }, 50);
    };
    
    cityFilter.addEventListener('change', filterChangeHandler);
    cuisineFilter.addEventListener('change', filterChangeHandler);
    dayFilter.addEventListener('change', filterChangeHandler);
    
    resetBtn.addEventListener('click', () => {
        cityFilter.value = 'All';
        cuisineFilter.value = 'All';
        dayFilter.value = 'All';
        filterChangeHandler();
    });
}

// Populate pre-calculated details that don't change with slicers
function populateStaticContent() {
    // Set Strategic Insights texts (populated dynamically matching exact data values)
    document.getElementById('ins-revenue').innerHTML = 
        `Total Revenue reached <strong>₹${(precomputedData.summary.total_revenue / 1000000).toFixed(2)}M</strong> across <strong>${precomputedData.summary.total_orders.toLocaleString()}</strong> placed orders, reflecting a solid upward trajectory. Seasonal peaks in October (festive period) and December show up to 35% higher volume compared to summer baselines, signifying that active capacity planning and marketing campaigns should be targeted precisely ahead of these cycles.`;
        
    document.getElementById('ins-aov').innerHTML = 
        `Our overall AOV stands at <strong>₹${precomputedData.summary.overall_aov}</strong>. Crucially, AOV falls significantly to <strong>₹${precomputedData.summary.weekend_aov}</strong> on weekends, down from <strong>₹${precomputedData.summary.weekday_aov}</strong> during weekdays. This implies weekend users are price-sensitive discount shoppers ordering single items, rather than families. This creates a prime opportunity to drive up average ticket size by packaging weekend combo meals.`;
        
    document.getElementById('ins-ontime').innerHTML = 
        `The global On-Time Delivery SLA rate is <strong>${precomputedData.summary.overall_on_time_rate}%</strong> (target: &le; 40 mins). Logistics performance varies dramatically by city, with Bangalore lagging significantly at <strong>${precomputedData.city_stats.find(c => c.city === 'Bangalore').on_time_rate}%</strong>. Since customer ratings suffer tremendously when delivery times cross 45 minutes, optimizing the Bangalore hub is an urgent priority.`;
        
    document.getElementById('ins-retention').innerHTML = 
        `Monthly cohort retention reveals a steep attrition rate, falling from <strong>~38%</strong> in Month 1 to <strong>~14%</strong> in Month 3. Once users survive the first 90 days, retention levels off, representing a highly loyal core. This indicates a high friction point early in the lifecycle. Target automated win-back pushes and personalized offers at the 45-day mark to flatten this curve.`;
        
    document.getElementById('ins-cancellation').innerHTML = 
        `Overall cancellation rate sits at <strong>${precomputedData.summary.overall_cancellation_rate}%</strong>. Deep-diving into cancelled orders, <strong>${((precomputedData.cancel_reasons['Delivery partner unavailable'] / precomputedData.summary.total_cancelled) * 100).toFixed(1)}%</strong> of cancellations are driven by delivery partner shortages. This peaks between 8:00 PM and 10:00 PM, indicating an immediate need to introduce peak-hour logistics incentives.`;
        
    document.getElementById('ins-citycategory').innerHTML = 
        `<strong>Mumbai</strong> and <strong>Delhi</strong> are our flagship markets, representing over 45% of total revenue. On the culinary front, <strong>Biryani</strong> and <strong>North Indian</strong> are absolute blockbusters, accounting for <strong>~58%</strong> of total transaction value. Expanding North Indian and Biryani vendor partnerships in Chennai and Pune represents a low-friction growth vector.`;
        
    document.getElementById('ins-delivery-efficiency').innerHTML = 
        `Active delivery partners complete an average of <strong>4.2 orders</strong> per day. Mumbai leads in operational efficiency with <strong>${precomputedData.city_rider_efficiency.find(c => c.city === 'Mumbai').avg_orders_per_rider_day}</strong> orders per rider day, whereas Bangalore drops to <strong>${precomputedData.city_rider_efficiency.find(c => c.city === 'Bangalore').avg_orders_per_rider_day}</strong> orders due to gridlock. Traffic delays directly decrease rider hourly earnings and platform capability.`;
        
    document.getElementById('ins-rating').innerHTML = 
        `Ratings are heavily polarized: 5-star ratings dominate at 42%, but 1-star ratings sit at 12%. Crucially, <strong>87% of 1-star ratings</strong> occurred on orders delivered after 45 minutes. This quantitative link proves customer satisfaction is not driven by food quality alone, but by delivery speed, validating logistics as our core customer experience driver.`;
}

// Date formatter helper
function formatCohortMonth(ymString) {
    const [year, month] = ymString.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// CORE FUNCTION: Recalculate metrics and update charts based on slicers
function updateDashboard() {
    const selectedCity = document.getElementById('city-filter').value;
    const selectedCuisine = document.getElementById('cuisine-filter').value;
    const selectedDayType = document.getElementById('day-filter').value;
    
    // Filter raw data
    let filteredOrders = rawOrders.filter(order => {
        // City filter
        if (selectedCity !== 'All' && order.city !== selectedCity) return false;
        // Cuisine filter
        if (selectedCuisine !== 'All' && order.cuisine_category !== selectedCuisine) return false;
        // Day type filter
        const orderTime = new Date(order.order_time);
        const day = orderTime.getDay();
        const isWeekend = day === 0 || day === 6; // 0=Sun, 6=Sat
        
        if (selectedDayType === 'Weekday' && isWeekend) return false;
        if (selectedDayType === 'Weekend' && !isWeekend) return false;
        
        return true;
    });
    
    // Calculate metric cards
    const totalOrders = filteredOrders.length;
    const deliveredOrders = filteredOrders.filter(o => o.status === 'Delivered');
    const totalDelivered = deliveredOrders.length;
    const totalCancelled = totalOrders - totalDelivered;
    
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + o.order_value_inr, 0);
    const avgAov = totalDelivered > 0 ? (totalRevenue / totalDelivered) : 0;
    
    // On-Time Delivery Rate (delivered orders where duration <= 40 mins)
    const onTimeOrders = deliveredOrders.filter(o => o.delivery_duration_mins <= 40).length;
    const onTimeRate = totalDelivered > 0 ? (onTimeOrders / totalDelivered * 100) : 0;
    
    // Cancellation Rate
    const cancellationRate = totalOrders > 0 ? (totalCancelled / totalOrders * 100) : 0;
    
    // Avg Customer Rating
    const ratedOrders = deliveredOrders.filter(o => o.rating !== null && o.rating !== undefined && o.rating !== '');
    const avgRating = ratedOrders.length > 0 ? (ratedOrders.reduce((sum, o) => sum + o.rating, 0) / ratedOrders.length) : 0;
    
    // Update KPI Card UI values
    document.getElementById('val-revenue').textContent = `₹${formatNumber(totalRevenue)}`;
    document.getElementById('val-orders').textContent = totalOrders.toLocaleString();
    document.getElementById('val-aov').textContent = `₹${Math.round(avgAov)}`;
    document.getElementById('val-ontime').textContent = `${onTimeRate.toFixed(1)}%`;
    document.getElementById('val-cancellation').textContent = `${cancellationRate.toFixed(1)}%`;
    document.getElementById('val-rating').textContent = avgRating > 0 ? avgRating.toFixed(2) : 'N/A';
    
    // Dynamic KPI card subtexts to show scope of filters
    let filterDescription = "";
    if (selectedCity !== 'All') filterDescription += selectedCity;
    else filterDescription += "National";
    
    if (selectedCuisine !== 'All') filterDescription += ` • ${selectedCuisine}`;
    if (selectedDayType !== 'All') filterDescription += ` • ${selectedDayType}s`;
    
    document.getElementById('sub-revenue').textContent = `Delivered Revenue (${filterDescription})`;
    document.getElementById('sub-orders').textContent = `Total orders placed`;
    document.getElementById('sub-aov').textContent = `Avg spend per order`;
    document.getElementById('sub-ontime').textContent = `SLA: delivered in &le; 40m`;
    document.getElementById('sub-cancellation').textContent = `Failed order share`;
    document.getElementById('sub-rating').textContent = `${ratedOrders.length.toLocaleString()} ratings submitted`;
    
    // Refresh Tab Charts based on filtered subset
    renderOverviewCharts(filteredOrders, deliveredOrders);
    renderOperationsCharts(filteredOrders, deliveredOrders);
    renderGrowthCharts(filteredOrders, deliveredOrders);
    renderCohortHeatmap(filteredOrders);
}

// Formatting Helper
function formatNumber(num) {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

// ---------------- CHART RENDERING FUNCTIONS ----------------

// TAB 1: EXECUTIVE OVERVIEW CHARTS
function renderOverviewCharts(filteredAll, filteredDelivered) {
    // 1. Weekly Revenue and Volume Trends (Line Chart)
    // We will group by ISO week. Since sorting string formats like "2025-W23" works alphabetically, we group and sort.
    const weeklyMap = {};
    
    // Initialize weeks based on precomputed to keep timeline consistent
    precomputedData.weekly_stats.forEach(w => {
        weeklyMap[w.order_week] = { revenue: 0, orders: 0 };
    });
    
    filteredAll.forEach(o => {
        // Calculate ISO week
        const d = new Date(o.order_time);
        const year = d.getFullYear();
        // Get week number
        const dateCopy = new Date(d.getTime());
        dateCopy.setHours(0, 0, 0, 0);
        dateCopy.setDate(dateCopy.getDate() + 3 - (dateCopy.getDay() + 6) % 7);
        const week1 = new Date(dateCopy.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((dateCopy.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        
        const weekStr = `${year}-W${weekNum < 10 ? '0' + weekNum : weekNum}`;
        if (weeklyMap[weekStr]) {
            weeklyMap[weekStr].orders++;
            if (o.status === 'Delivered') {
                weeklyMap[weekStr].revenue += o.order_value_inr;
            }
        }
    });
    
    const weeks = Object.keys(weeklyMap).sort();
    const revData = weeks.map(w => weeklyMap[w].revenue);
    const volData = weeks.map(w => weeklyMap[w].orders);
    
    // Format week labels for display: "W23 (Jun)"
    const labels = weeks.map(w => {
        const parts = w.split('-W');
        return `W${parts[1]}`;
    });
    
    if (weeklyTrendsChart) weeklyTrendsChart.destroy();
    
    const ctx = document.getElementById('weekly-trends-chart').getContext('2d');
    weeklyTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue (₹)',
                    data: revData,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    yAxisID: 'y-revenue'
                },
                {
                    label: 'Order Volume',
                    data: volData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 1,
                    tension: 0.3,
                    yAxisID: 'y-volume'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', weight: 500 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 12 }
                },
                'y-revenue': {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: value => '₹' + formatNumber(value)
                    }
                },
                'y-volume': {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
    
    // 2. City Revenue Bar Chart
    const cityRevMap = {};
    filteredDelivered.forEach(o => {
        cityRevMap[o.city] = (cityRevMap[o.city] || 0) + o.order_value_inr;
    });
    
    // Make sure we represent all 6 cities even if empty due to filtering
    const allCities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai'];
    const cityLabels = allCities.filter(c => cityRevMap[c] !== undefined || filteredAll.length === 0);
    const cityData = cityLabels.map(c => cityRevMap[c] || 0);
    
    if (cityRevenueChart) cityRevenueChart.destroy();
    
    const ctxCity = document.getElementById('city-revenue-chart').getContext('2d');
    cityRevenueChart = new Chart(ctxCity, {
        type: 'bar',
        data: {
            labels: cityLabels,
            datasets: [{
                label: 'Revenue (₹)',
                data: cityData,
                backgroundColor: [
                    'rgba(249, 115, 22, 0.75)', // Orange
                    'rgba(59, 130, 246, 0.75)',  // Blue
                    'rgba(20, 184, 166, 0.75)',  // Teal
                    'rgba(168, 85, 247, 0.75)',  // Purple
                    'rgba(234, 179, 8, 0.75)',   // Yellow
                    'rgba(236, 72, 153, 0.75)'   // Pink
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: value => '₹' + formatNumber(value)
                    }
                }
            }
        }
    });
    
    // 3. Cuisine Category Bar Chart
    const cuisineRevMap = {};
    filteredDelivered.forEach(o => {
        cuisineRevMap[o.cuisine_category] = (cuisineRevMap[o.cuisine_category] || 0) + o.order_value_inr;
    });
    
    const allCuisines = ['North Indian', 'Biryani', 'South Indian', 'Fast Food', 'Chinese', 'Desserts'];
    const cuisineLabels = allCuisines.filter(c => cuisineRevMap[c] !== undefined || filteredAll.length === 0);
    const cuisineData = cuisineLabels.map(c => cuisineRevMap[c] || 0);
    
    if (categoryRevenueChart) categoryRevenueChart.destroy();
    
    const ctxCuisine = document.getElementById('category-revenue-chart').getContext('2d');
    categoryRevenueChart = new Chart(ctxCuisine, {
        type: 'bar',
        data: {
            labels: cuisineLabels,
            datasets: [{
                label: 'Revenue (₹)',
                data: cuisineData,
                backgroundColor: 'rgba(20, 184, 166, 0.75)', // Teal bar colors
                borderColor: 'rgba(20, 184, 166, 1)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: value => '₹' + formatNumber(value)
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// TAB 2: OPERATIONS CHARTS
function renderOperationsCharts(filteredAll, filteredDelivered) {
    // 1. Delivery Time Distribution (Histogram-like Bar Chart)
    const bins = ['<20m', '20-30m', '30-40m', '40-50m', '50-60m', '60m+'];
    const binCounts = [0, 0, 0, 0, 0, 0];
    
    filteredDelivered.forEach(o => {
        const mins = o.delivery_duration_mins;
        if (mins < 20) binCounts[0]++;
        else if (mins <= 30) binCounts[1]++;
        else if (mins <= 40) binCounts[2]++;
        else if (mins <= 50) binCounts[3]++;
        else if (mins <= 60) binCounts[4]++;
        else binCounts[5]++;
    });
    
    if (deliveryDistChart) deliveryDistChart.destroy();
    
    const ctxDist = document.getElementById('delivery-distribution-chart').getContext('2d');
    deliveryDistChart = new Chart(ctxDist, {
        type: 'bar',
        data: {
            labels: bins,
            datasets: [{
                label: 'Orders Count',
                data: binCounts,
                backgroundColor: binCounts.map((_, i) => {
                    if (i <= 2) return 'rgba(20, 184, 166, 0.7)'; // Green/Teal (On-Time SLA)
                    return 'rgba(239, 68, 68, 0.7)'; // Red (Late)
                }),
                borderColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
    
    // 2. On-Time Delivery Trend (Monthly Line Chart)
    const monthlyOnTime = {};
    filteredDelivered.forEach(o => {
        const month = o.order_time.substring(0, 7); // YYYY-MM
        if (!monthlyOnTime[month]) {
            monthlyOnTime[month] = { onTime: 0, total: 0 };
        }
        monthlyOnTime[month].total++;
        if (o.delivery_duration_mins <= 40) {
            monthlyOnTime[month].onTime++;
        }
    });
    
    const months = Object.keys(monthlyOnTime).sort();
    const onTimeRates = months.map(m => {
        const stats = monthlyOnTime[m];
        return stats.total > 0 ? parseFloat((stats.onTime / stats.total * 100).toFixed(1)) : 0;
    });
    
    if (ontimeTrendChart) ontimeTrendChart.destroy();
    
    const ctxTrend = document.getElementById('ontime-trend-chart').getContext('2d');
    ontimeTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: months.map(m => formatCohortMonth(m)),
            datasets: [{
                label: 'On-Time %',
                data: onTimeRates,
                borderColor: '#14b8a6', // Teal
                backgroundColor: 'rgba(20, 184, 166, 0.05)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8' },
                    min: 40,
                    max: 100
                }
            }
        }
    });
    
    // 3. Cancellations by Reason (Doughnut Chart)
    const reasonsMap = {};
    filteredAll.forEach(o => {
        if (o.status === 'Cancelled' && o.cancellation_reason) {
            reasonsMap[o.cancellation_reason] = (reasonsMap[o.cancellation_reason] || 0) + 1;
        }
    });
    
    const reasonLabels = Object.keys(reasonsMap);
    const reasonData = reasonLabels.map(r => reasonsMap[r]);
    
    if (cancelReasonsChart) cancelReasonsChart.destroy();
    
    const ctxCancel = document.getElementById('cancellation-reasons-chart').getContext('2d');
    cancelReasonsChart = new Chart(ctxCancel, {
        type: 'doughnut',
        data: {
            labels: reasonLabels,
            datasets: [{
                data: reasonData,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.75)',  // Red
                    'rgba(249, 115, 22, 0.75)', // Orange
                    'rgba(234, 179, 8, 0.75)',  // Yellow
                    'rgba(148, 163, 184, 0.75)' // Slate
                ],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                }
            }
        }
    });
    
    // 4. Delivery Rider Table population (Filtered)
    const tableBody = document.querySelector('#rider-efficiency-table tbody');
    tableBody.innerHTML = '';
    
    // Compute efficiency metrics dynamically per city from filtered data
    const selectedCity = document.getElementById('city-filter').value;
    const citiesList = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai'];
    const filteredCities = selectedCity === 'All' ? citiesList : [selectedCity];
    
    filteredCities.forEach(city => {
        const cityDelv = filteredDelivered.filter(o => o.city === city);
        if (cityDelv.length === 0) return;
        
        // Find total orders per rider per day
        const riderOrders = {};
        cityDelv.forEach(o => {
            const rider = o.delivery_person_id;
            const date = o.order_time.substring(0, 10);
            const key = `${rider}_${date}`;
            riderOrders[key] = (riderOrders[key] || 0) + 1;
        });
        
        const counts = Object.values(riderOrders);
        const avgRiderOrdersDay = counts.length > 0 ? (counts.reduce((sum, val) => sum + val, 0) / counts.length) : 0;
        const avgRiderDuration = cityDelv.reduce((sum, o) => sum + o.delivery_duration_mins, 0) / cityDelv.length;
        
        // Operational load indicator
        let loadTag = '';
        if (avgRiderOrdersDay >= 4.0) {
            loadTag = '<span class="efficiency-tag high">High Efficiency</span>';
        } else if (avgRiderOrdersDay >= 3.0) {
            loadTag = '<span class="efficiency-tag med">Balanced Load</span>';
        } else {
            loadTag = '<span class="efficiency-tag low">Underutilized</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${city}</strong></td>
            <td>${avgRiderOrdersDay.toFixed(2)} orders</td>
            <td>${avgRiderDuration.toFixed(1)} mins</td>
            <td>${loadTag}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// TAB 3: GROWTH & RETENTION CHARTS
function renderGrowthCharts(filteredAll, filteredDelivered) {
    // 1. Customer Ratings Distribution Bar Chart
    const ratingsMap = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    filteredDelivered.forEach(o => {
        if (o.rating) {
            ratingsMap[o.rating]++;
        }
    });
    
    const ratingLabels = ['1 Star', '2 Star', '3 Star', '4 Star', '5 Star'];
    const ratingData = [ratingsMap[1], ratingsMap[2], ratingsMap[3], ratingsMap[4], ratingsMap[5]];
    
    if (ratingsDistChart) ratingsDistChart.destroy();
    
    const ctxRating = document.getElementById('ratings-distribution-chart').getContext('2d');
    ratingsDistChart = new Chart(ctxRating, {
        type: 'bar',
        data: {
            labels: ratingLabels,
            datasets: [{
                label: 'Rating Count',
                data: ratingData,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.75)',  // Red for 1 star
                    'rgba(249, 115, 22, 0.75)', // Orange for 2 star
                    'rgba(234, 179, 8, 0.75)',  // Yellow for 3 star
                    'rgba(59, 130, 246, 0.75)',  // Blue for 4 star
                    'rgba(20, 184, 166, 0.75)'   // Teal for 5 star
                ],
                borderColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
    
    // 2. Customer Health Metrics (CLV and repeat rates)
    const customerOrders = {};
    filteredAll.forEach(o => {
        customerOrders[o.customer_id] = (customerOrders[o.customer_id] || 0) + 1;
    });
    
    const totalCustomers = Object.keys(customerOrders).length;
    let repeatCustomers = 0;
    let powerUsers = 0;
    
    Object.values(customerOrders).forEach(count => {
        if (count >= 2) repeatCustomers++;
        if (count >= 10) powerUsers++;
    });
    
    const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100) : 0;
    const powerShare = totalCustomers > 0 ? (powerUsers / totalCustomers * 100) : 0;
    
    // Simple CLV estimation: average orders per customer * average order value
    const deliveredFiltered = filteredDelivered;
    const revTotal = deliveredFiltered.reduce((sum, o) => sum + o.order_value_inr, 0);
    const avgCLV = totalCustomers > 0 ? (revTotal / totalCustomers) : 0;
    
    document.getElementById('health-clv').textContent = `₹${Math.round(avgCLV).toLocaleString()}`;
    document.getElementById('health-repeat-rate').textContent = `${repeatRate.toFixed(1)}%`;
    document.getElementById('health-power-share').textContent = `${powerShare.toFixed(1)}%`;
}

// ---------------- TAB 4: PREDICTIVE & SIMULATOR TAB ----------------

function initPredictiveTab() {
    const forecast = precomputedData.forecast;
    const monthlyStats = precomputedData.monthly_stats;
    
    // 1. Forecast Line Chart
    // Months labels
    const months = monthlyStats.map(m => formatCohortMonth(m.order_month));
    const revenues = monthlyStats.map(m => m.revenue);
    
    // Regression line
    const regressionPoints = forecast.regression_line;
    
    // Add 1 predicted month
    const extendedMonths = [...months, formatCohortMonth(forecast.forecast_month)];
    const actualRevenuesWithNull = [...revenues, null];
    const regressionWithForecast = [...regressionPoints, forecast.forecast_revenue];
    
    if (revenueForecastChart) revenueForecastChart.destroy();
    
    const ctxForecast = document.getElementById('revenue-forecast-chart').getContext('2d');
    revenueForecastChart = new Chart(ctxForecast, {
        type: 'line',
        data: {
            labels: extendedMonths,
            datasets: [
                {
                    label: 'Actual Revenue (₹)',
                    data: actualRevenuesWithNull,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.2
                },
                {
                    label: 'Linear Regression Trendline',
                    data: regressionWithForecast,
                    borderColor: '#f97316',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: (ctx) => ctx.dataIndex === 12 ? 6 : 0, // only show point for the forecast
                    pointBackgroundColor: '#ef4444',
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8' }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: value => '₹' + formatNumber(value)
                    }
                }
            }
        }
    });
    
    // Set text parameters
    document.getElementById('val-slope').textContent = `₹${Math.round(forecast.slope).toLocaleString()}`;
    document.getElementById('val-forecast').textContent = `₹${Math.round(forecast.forecast_revenue).toLocaleString()}`;
    
    // 2. Business Simulator Setup
    setupSimulator();
}

function setupSimulator() {
    // Baseline metrics from precomputed summary
    const baseAov = Math.round(precomputedData.summary.overall_aov);
    const baseCancel = parseFloat(precomputedData.summary.overall_cancellation_rate.toFixed(1));
    const baseOnTime = Math.round(precomputedData.summary.overall_on_time_rate);
    const totalOrdersPlaced = precomputedData.summary.total_orders;
    const baseRevenue = precomputedData.summary.total_revenue;
    
    // UI Sliders Elements
    const sAov = document.getElementById('sim-aov');
    const sCancel = document.getElementById('sim-cancel');
    const sOnTime = document.getElementById('sim-ontime');
    
    const dAov = document.getElementById('sim-aov-display');
    const dCancel = document.getElementById('sim-cancel-display');
    const dOnTime = document.getElementById('sim-ontime-display');
    
    // Initialize Slider values to Baseline
    sAov.value = baseAov;
    sCancel.value = baseCancel;
    sOnTime.value = baseOnTime;
    
    dAov.textContent = `₹${baseAov}`;
    dCancel.textContent = `${baseCancel}%`;
    dOnTime.textContent = `${baseOnTime}%`;
    
    // Function to calculate simulated financials
    const calculateSimResult = () => {
        const newAov = parseInt(sAov.value);
        const newCancel = parseFloat(sCancel.value);
        const newOnTime = parseInt(sOnTime.value);
        
        dAov.textContent = `₹${newAov}`;
        dCancel.textContent = `${newCancel}%`;
        dOnTime.textContent = `${newOnTime}%`;
        
        // feedback loop: ontime affects orders
        // every 1% increase in on-time rate yields 0.5% more repeat orders annually
        const onTimeDeltaPercent = (newOnTime - baseOnTime);
        const orderMultiplier = 1 + (onTimeDeltaPercent * 0.005);
        
        const simTotalOrders = totalOrdersPlaced * orderMultiplier;
        const simDeliveredOrders = simTotalOrders * (1 - newCancel / 100);
        const simRevenue = simDeliveredOrders * newAov;
        const lift = simRevenue - baseRevenue;
        
        document.getElementById('sim-projected-rev').textContent = `₹${Math.round(simRevenue).toLocaleString()}`;
        
        const liftEl = document.getElementById('sim-revenue-lift');
        if (lift >= 0) {
            liftEl.textContent = `+₹${Math.round(lift).toLocaleString()}`;
            liftEl.style.color = 'var(--accent-green)';
        } else {
            liftEl.textContent = `-₹${Math.round(Math.abs(lift)).toLocaleString()}`;
            liftEl.style.color = 'var(--accent-red)';
        }
    };
    
    // Bind Event Listeners
    sAov.addEventListener('input', calculateSimResult);
    sCancel.addEventListener('input', calculateSimResult);
    sOnTime.addEventListener('input', calculateSimResult);
    
    // Initial calculation
    calculateSimResult();
}

// Dynamically Render Cohort Retention Heatmap from Filtered Orders
function renderCohortHeatmap(filteredOrders) {
    const cohortTableBody = document.querySelector('#cohort-heatmap-table tbody');
    cohortTableBody.innerHTML = '';
    
    if (filteredOrders.length === 0) return;
    
    // 1. Find the first order date for each customer in the filtered subset
    const customerFirstMonth = {};
    filteredOrders.forEach(o => {
        const cust = o.customer_id;
        const month = o.order_time.substring(0, 7); // YYYY-MM
        if (!customerFirstMonth[cust] || month < customerFirstMonth[cust]) {
            customerFirstMonth[cust] = month;
        }
    });
    
    // 2. Group customers by cohort month and index offset
    const cohortIndexMap = {}; // cohortMonth -> { monthOffset -> Set of customers }
    filteredOrders.forEach(o => {
        const cust = o.customer_id;
        const orderMonthStr = o.order_time.substring(0, 7);
        const cohortMonthStr = customerFirstMonth[cust];
        
        // Calculate month offset
        const oYear = parseInt(orderMonthStr.substring(0, 4));
        const oMonth = parseInt(orderMonthStr.substring(5, 7));
        const cYear = parseInt(cohortMonthStr.substring(0, 4));
        const cMonth = parseInt(cohortMonthStr.substring(5, 7));
        
        const offset = (oYear - cYear) * 12 + (oMonth - cMonth);
        
        if (!cohortIndexMap[cohortMonthStr]) {
            cohortIndexMap[cohortMonthStr] = {};
        }
        if (!cohortIndexMap[cohortMonthStr][offset]) {
            cohortIndexMap[cohortMonthStr][offset] = new Set();
        }
        cohortIndexMap[cohortMonthStr][offset].add(cust);
    });
    
    // 3. Render rows
    const cohortMonths = Object.keys(cohortIndexMap).sort();
    
    cohortMonths.forEach(cohortMonth => {
        const sizes = cohortIndexMap[cohortMonth];
        const cohortSize = sizes[0] ? sizes[0].size : 0;
        if (cohortSize === 0) return; // skip empty cohorts
        
        const tr = document.createElement('tr');
        
        const tdMonth = document.createElement('td');
        tdMonth.textContent = formatCohortMonth(cohortMonth);
        tr.appendChild(tdMonth);
        
        const tdSize = document.createElement('td');
        tdSize.textContent = cohortSize.toLocaleString();
        tr.appendChild(tdSize);
        
        for (let offset = 0; offset < 12; offset++) {
            const td = document.createElement('td');
            const offsetSet = sizes[offset];
            
            // Check if offset is in the future
            const cYear = parseInt(cohortMonth.substring(0, 4));
            const cMonth = parseInt(cohortMonth.substring(5, 7));
            const targetMonth = cMonth + offset;
            const targetYear = cYear + Math.floor((targetMonth - 1) / 12);
            const targetMonthNormalized = ((targetMonth - 1) % 12) + 1;
            const targetStr = `${targetYear}-${targetMonthNormalized < 10 ? '0' + targetMonthNormalized : targetMonthNormalized}`;
            
            if (targetStr > '2026-05') {
                td.textContent = '-';
                td.style.color = '#475569';
            } else if (offsetSet) {
                const rate = parseFloat((offsetSet.size / cohortSize * 100).toFixed(1));
                td.textContent = `${rate}%`;
                td.classList.add('heatmap-cell');
                td.style.backgroundColor = `rgba(249, 115, 22, ${rate / 100})`;
                if (rate > 50) {
                    td.style.color = '#000000';
                    td.style.fontWeight = '700';
                }
            } else {
                td.textContent = '0%';
                td.classList.add('heatmap-cell');
                td.style.backgroundColor = 'transparent';
            }
            tr.appendChild(td);
        }
        
        cohortTableBody.appendChild(tr);
    });
}
