import json
import pandas as pd
import numpy as np
from datetime import datetime

def run_data_processing():
    print("Loading raw order data...")
    # Load dataset
    df = pd.read_csv('orders_raw.csv')
    
    # --- STEP 3: CLEAN DATA ---
    print("Cleaning and preparing data...")
    # Ensure datetime format
    df['order_time'] = pd.to_datetime(df['order_time'])
    df['delivered_time'] = pd.to_datetime(df['delivered_time'])
    
    # Drop duplicates if any
    df = df.drop_duplicates()
    
    # Handle missing values: Fill rating with null (already is) and cancel reasons (already is)
    # Verify calculated column for delivery duration
    # Since we generated delivery_duration_mins directly, we can check it and create an on_time flag
    # Let's say on-time target is <= 40 minutes
    df['is_on_time'] = df['delivery_duration_mins'] <= 40
    
    # Save the cleaned data to orders_cleaned.csv
    df.to_csv('orders_cleaned.csv', index=False)
    print("Cleaned data saved to orders_cleaned.csv.")
    
    # --- STEP 5: CALCULATE KPIs ---
    print("Calculating KPIs...")
    
    # 1. Executive Summary Indicators
    total_orders = int(len(df))
    delivered_orders_df = df[df['status'] == 'Delivered']
    total_delivered = int(len(delivered_orders_df))
    cancelled_orders_df = df[df['status'] == 'Cancelled']
    total_cancelled = int(len(cancelled_orders_df))
    
    total_revenue = int(delivered_orders_df['order_value_inr'].sum())
    overall_aov = round(float(delivered_orders_df['order_value_inr'].mean()), 2)
    
    # On-Time Delivery Rate
    overall_on_time_rate = round(float(delivered_orders_df['is_on_time'].mean() * 100), 2)
    
    # Cancellation Rate
    overall_cancellation_rate = round(float(total_cancelled / total_orders * 100), 2)
    
    # Average Delivery Duration
    avg_delivery_duration = round(float(delivered_orders_df['delivery_duration_mins'].mean()), 1)
    
    # Rating metrics
    rated_orders = delivered_orders_df[delivered_orders_df['rating'].notna()]
    avg_rating = round(float(rated_orders['rating'].mean()), 2)
    rating_distribution = rated_orders['rating'].value_counts().sort_index().to_dict()
    # Convert rating distribution keys to strings for JSON
    rating_distribution = {str(k): int(v) for k, v in rating_distribution.items()}
    
    # Weekday vs Weekend metrics
    df['day_of_week'] = df['order_time'].dt.day_name()
    df['is_weekend'] = df['order_time'].dt.weekday >= 5
    
    delivered_weekend = delivered_orders_df[delivered_orders_df['order_time'].dt.weekday >= 5]
    delivered_weekday = delivered_orders_df[delivered_orders_df['order_time'].dt.weekday < 5]
    
    weekend_aov = round(float(delivered_weekend['order_value_inr'].mean()), 2)
    weekday_aov = round(float(delivered_weekday['order_value_inr'].mean()), 2)
    
    weekend_orders = len(df[df['is_weekend'] == True])
    weekday_orders = len(df[df['is_weekend'] == False])
    
    # 2. Revenue and Order Trends (Monthly)
    df['order_month'] = df['order_time'].dt.to_period('M').astype(str)
    
    monthly_stats = df.groupby('order_month').agg(
        orders=('order_id', 'count'),
        delivered_orders=('status', lambda x: (x == 'Delivered').sum()),
        revenue=('order_value_inr', lambda x: x[df.loc[x.index, 'status'] == 'Delivered'].sum())
    ).reset_index()
    
    monthly_stats['aov'] = round(monthly_stats['revenue'] / monthly_stats['delivered_orders'], 2)
    monthly_stats = monthly_stats.sort_values('order_month').to_dict(orient='records')
    
    # 3. Revenue and Order Trends (Weekly)
    df['order_week'] = df['order_time'].dt.to_period('W').astype(str)
    weekly_stats = df.groupby('order_week').agg(
        orders=('order_id', 'count'),
        delivered_orders=('status', lambda x: (x == 'Delivered').sum()),
        revenue=('order_value_inr', lambda x: x[df.loc[x.index, 'status'] == 'Delivered'].sum())
    ).reset_index()
    weekly_stats['aov'] = round(weekly_stats['revenue'] / weekly_stats['delivered_orders'], 2)
    weekly_stats = weekly_stats.sort_values('order_week').to_dict(orient='records')
    
    # 4. Revenue & Volumes by City
    city_stats = df.groupby('city').agg(
        orders=('order_id', 'count'),
        delivered_orders=('status', lambda x: (x == 'Delivered').sum()),
        revenue=('order_value_inr', lambda x: x[df.loc[x.index, 'status'] == 'Delivered'].sum()),
        on_time_rate=('is_on_time', lambda x: round(float(x[df.loc[x.index, 'status'] == 'Delivered'].mean() * 100), 2)),
        cancellation_rate=('status', lambda x: round(float((x == 'Cancelled').mean() * 100), 2)),
        avg_duration=('delivery_duration_mins', lambda x: round(float(x[df.loc[x.index, 'status'] == 'Delivered'].mean()), 1))
    ).reset_index().to_dict(orient='records')
    
    # 5. Revenue & Volumes by Category
    category_stats = df.groupby('cuisine_category').agg(
        orders=('order_id', 'count'),
        delivered_orders=('status', lambda x: (x == 'Delivered').sum()),
        revenue=('order_value_inr', lambda x: x[df.loc[x.index, 'status'] == 'Delivered'].sum()),
        avg_rating=('rating', lambda x: round(float(x.dropna().mean()), 2) if len(x.dropna()) > 0 else 0)
    ).reset_index().to_dict(orient='records')
    
    # 6. Cancellation Reasons Detail
    cancel_reasons = cancelled_orders_df['cancellation_reason'].value_counts().to_dict()
    cancel_reasons = {str(k): int(v) for k, v in cancel_reasons.items()}
    
    # 7. Delivery Partner Efficiency (Orders per Hour Active, average delivery times)
    # Let's count how many distinct days a rider had orders to find average orders per active day
    rider_activity = delivered_orders_df.groupby('delivery_person_id').agg(
        total_orders=('order_id', 'count'),
        active_days=('order_time', lambda x: x.dt.date.nunique()),
        avg_duration=('delivery_duration_mins', 'mean')
    ).reset_index()
    
    rider_activity['orders_per_active_day'] = round(rider_activity['total_orders'] / rider_activity['active_days'], 2)
    rider_activity['avg_duration'] = round(rider_activity['avg_duration'], 1)
    
    # Average orders per rider per active day by city
    rider_with_city = pd.merge(rider_activity, df[['delivery_person_id', 'city']].drop_duplicates(), on='delivery_person_id', how='left')
    city_rider_efficiency = rider_with_city.groupby('city').agg(
        avg_orders_per_rider_day=('orders_per_active_day', 'mean'),
        avg_rider_duration=('avg_duration', 'mean')
    ).reset_index()
    city_rider_efficiency['avg_orders_per_rider_day'] = round(city_rider_efficiency['avg_orders_per_rider_day'], 2)
    city_rider_efficiency['avg_rider_duration'] = round(city_rider_efficiency['avg_rider_duration'], 1)
    city_rider_efficiency = city_rider_efficiency.to_dict(orient='records')
    
    # 8. Customer Retention Cohort Analysis
    print("Performing Cohort Analysis...")
    # Get the cohort month (first order month) for each customer
    df['order_month_date'] = df['order_time'].dt.to_period('M')
    df['cohort_month'] = df.groupby('customer_id')['order_month_date'].transform('min')
    
    # Cohort group statistics
    df['cohort_index'] = (df['order_month_date'] - df['cohort_month']).apply(lambda attr: attr.n)
    
    cohort_data = df.groupby(['cohort_month', 'cohort_index']).agg(
        unique_customers=('customer_id', 'nunique')
    ).reset_index()
    
    # Pivot cohort data
    cohort_pivot = cohort_data.pivot(index='cohort_month', columns='cohort_index', values='unique_customers')
    cohort_sizes = cohort_pivot.iloc[:, 0]
    
    # Calculate retention rates as percentages
    retention_matrix = cohort_pivot.divide(cohort_sizes, axis=0) * 100
    retention_matrix = retention_matrix.round(1)
    
    # Format Cohort Analysis for output
    cohort_retention = []
    cohort_months = [str(x) for x in cohort_pivot.index]
    
    for i, month in enumerate(cohort_months):
        cohort_size = int(cohort_sizes.iloc[i])
        rates = []
        for col in cohort_pivot.columns:
            val = retention_matrix.iloc[i, col]
            if not np.isnan(val):
                rates.append(float(val))
            else:
                rates.append(None)
        
        cohort_retention.append({
            'cohort_month': month,
            'cohort_size': cohort_size,
            'retention_rates': rates
        })
        
    # 9. Predictive Revenue Forecast (Linear Regression)
    print("Computing Revenue Forecast...")
    # Fit regression on monthly revenue
    # Month index 0 (June 2025) to 11 (May 2026)
    month_indices = np.arange(len(monthly_stats))
    monthly_revenues = np.array([m['revenue'] for m in monthly_stats])
    
    # Fit line: y = m * x + c
    slope, intercept = np.polyfit(month_indices, monthly_revenues, 1)
    
    # Generate regression line points
    regression_line = [round(float(slope * x + intercept), 2) for x in month_indices]
    
    # Forecast for June 2026 (index 12)
    forecast_month_index = 12
    forecast_value = round(float(slope * forecast_month_index + intercept), 2)
    
    forecast_data = {
        'slope': float(slope),
        'intercept': float(intercept),
        'regression_line': regression_line,
        'forecast_month': '2026-06',
        'forecast_revenue': forecast_value
    }
    
    # Combine everything into dashboard_data
    dashboard_data = {
        'summary': {
            'total_orders': total_orders,
            'total_delivered': total_delivered,
            'total_cancelled': total_cancelled,
            'total_revenue': total_revenue,
            'overall_aov': overall_aov,
            'overall_on_time_rate': overall_on_time_rate,
            'overall_cancellation_rate': overall_cancellation_rate,
            'avg_delivery_duration': avg_delivery_duration,
            'avg_rating': avg_rating,
            'weekend_aov': weekend_aov,
            'weekday_aov': weekday_aov,
            'weekend_orders': weekend_orders,
            'weekday_orders': weekday_orders
        },
        'rating_distribution': rating_distribution,
        'monthly_stats': monthly_stats,
        'weekly_stats': weekly_stats,
        'city_stats': city_stats,
        'category_stats': category_stats,
        'cancel_reasons': cancel_reasons,
        'city_rider_efficiency': city_rider_efficiency,
        'cohort_retention': cohort_retention,
        'forecast': forecast_data
    }
    
    # Save to JSON
    with open('dashboard_data.json', 'w') as f:
        json.dump(dashboard_data, f, indent=4)
        
    print("Data processing complete. dashboard_data.json saved.")

if __name__ == "__main__":
    run_data_processing()
