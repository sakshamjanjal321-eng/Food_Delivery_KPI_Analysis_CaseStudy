import numpy as np
import pandas as pd
import random
from datetime import datetime, timedelta

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

def generate_orders_dataset(num_orders=25000):
    cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai']
    categories = ['North Indian', 'Biryani', 'South Indian', 'Fast Food', 'Chinese', 'Desserts']
    
    # Customer base
    num_customers = 3500
    customer_ids = [f"CUST_{1000 + i}" for i in range(num_customers)]
    # Assign each customer a home city so they order within their city
    customer_city_map = {cust: random.choice(cities) for cust in customer_ids}
    
    # Delivery partners base
    num_riders = 300
    rider_ids = [f"DELV_{100 + i}" for i in range(num_riders)]
    rider_city_map = {rider: random.choice(cities) for rider in rider_ids}
    city_riders = {city: [r for r in rider_ids if rider_city_map[r] == city] for city in cities}
    
    # Establish a start date and end date
    start_date = datetime(2025, 6, 1)
    end_date = datetime(2026, 5, 31)
    total_days = (end_date - start_date).days + 1
    
    # Define cuisine preferences per city to make the data richer
    city_cuisine_weights = {
        'Mumbai': [0.25, 0.15, 0.10, 0.25, 0.15, 0.10], # North Indian, Biryani, South Indian, Fast Food, Chinese, Desserts
        'Delhi': [0.40, 0.15, 0.05, 0.20, 0.15, 0.05],
        'Bangalore': [0.15, 0.20, 0.20, 0.20, 0.15, 0.10],
        'Hyderabad': [0.10, 0.50, 0.15, 0.10, 0.10, 0.05],
        'Pune': [0.25, 0.15, 0.15, 0.20, 0.15, 0.10],
        'Chennai': [0.10, 0.20, 0.40, 0.10, 0.10, 0.10]
    }
    
    data = []
    
    # Generate dates. We want weekend days to have ~35% more orders.
    # We will generate order timestamps distributed across the year.
    order_timestamps = []
    current_time = start_date
    
    # Pre-calculate probabilities for active customers
    # We'll make customer selection non-uniform to simulate power users vs churned ones
    customer_weights = np.random.zipf(1.6, size=num_customers)
    customer_weights = customer_weights / customer_weights.sum()
    
    print("Generating order timestamps and attributes...")
    
    for i in range(num_orders):
        # Determine date
        # Randomly select a day in the year
        day_offset = random.randint(0, total_days - 1)
        order_date = start_date + timedelta(days=day_offset)
        
        # Determine hour based on peaks: Lunch (12-15), Dinner (19-23), Else (other times)
        hour_prob = np.zeros(24)
        hour_prob[11:15] = 0.08  # Lunch peak
        hour_prob[18:23] = 0.13  # Dinner peak
        hour_prob[8:11] = 0.02   # Breakfast
        hour_prob[15:18] = 0.03  # Afternoon
        hour_prob[23:24] = 0.02  # Night
        hour_prob[0:8] = 0.005   # Late night/early morning
        hour_prob = hour_prob / hour_prob.sum()
        
        hour = np.random.choice(24, p=hour_prob)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        order_time = order_date.replace(hour=hour, minute=minute, second=second)
        
        # Select customer
        customer = np.random.choice(customer_ids, p=customer_weights)
        city = customer_city_map[customer]
        
        # Select cuisine category based on city preferences
        category = np.random.choice(categories, p=city_cuisine_weights[city])
        
        # Base order value centered around 350
        # AOV drops on weekends to ₹280 as requested, and varies by category
        is_weekend = order_time.weekday() >= 5 # 5=Sat, 6=Sun
        
        if is_weekend:
            mean_aov = 280
            std_aov = 100
        else:
            mean_aov = 380
            std_aov = 150
            
        # Category adjustments
        if category in ['Biryani', 'North Indian']:
            mean_aov += 60
        elif category in ['Desserts', 'South Indian']:
            mean_aov -= 80
            
        # City adjustments
        if city in ['Bangalore', 'Mumbai']:
            mean_aov += 30
        elif city in ['Pune']:
            mean_aov -= 20
            
        order_value = int(np.random.normal(mean_aov, std_aov))
        order_value = max(120, min(order_value, 2500)) # Clamped between 120 and 2500 INR
        
        # Distance (km)
        distance = round(np.random.exponential(scale=3.0) + 1.0, 1)
        distance = min(distance, 15.0) # Cap distance at 15km
        
        # Status & Cancellation Reason
        # Cancellation rate is ~6% overall.
        # It's slightly higher during dinner peaks and weekend rushes due to delivery partner shortages.
        cancellation_prob = 0.05
        if hour in [20, 21, 22]:
            cancellation_prob += 0.03
        if is_weekend:
            cancellation_prob += 0.02
            
        status = "Delivered"
        cancel_reason = ""
        if random.random() < cancellation_prob:
            status = "Cancelled"
            reasons = ["Customer cancelled", "Restaurant rejected", "Delivery partner unavailable", "Delayed delivery cancel"]
            # Weights: unavailable = 35%, customer = 35%, restaurant = 20%, delayed = 10%
            cancel_reason = np.random.choice(reasons, p=[0.35, 0.20, 0.35, 0.10])
            
        # Delivery times and ratings (if delivered)
        delivered_time = None
        delivery_time_mins = None
        rider = ""
        rating = None
        
        if status == "Delivered":
            # Assign rider in the same city
            riders_list = city_riders[city]
            rider = random.choice(riders_list) if riders_list else "DELV_999"
            
            # Calculate delivery duration (minutes)
            # Prep time (12-25 mins) + Travel time (distance * 3-4 mins) + Traffic delay
            prep_time = random.randint(12, 25)
            speed_per_km = random.uniform(2.5, 4.0)
            travel_time = distance * speed_per_km
            
            # Traffic delays
            traffic_delay = 0
            # Bangalore traffic is notoriously heavy, followed by Mumbai
            traffic_multiplier = 1.0
            if city == 'Bangalore':
                traffic_multiplier = 1.6
            elif city == 'Mumbai':
                traffic_multiplier = 1.3
                
            # Peaks have traffic delay
            if hour in [12, 13, 14, 19, 20, 21, 22]:
                traffic_delay = random.uniform(8, 20) * traffic_multiplier
            else:
                traffic_delay = random.uniform(2, 8) * traffic_multiplier
                
            delivery_time_mins = int(prep_time + travel_time + traffic_delay)
            delivery_time_mins = max(15, delivery_time_mins) # Minimum 15 minutes
            
            delivered_time = order_time + timedelta(minutes=delivery_time_mins)
            
            # On-time target is 40 minutes
            is_on_time = delivery_time_mins <= 40
            
            # Ratings: 1 to 5 stars. Highly correlated with delivery speed.
            # 60% probability of leaving a rating
            if random.random() < 0.65:
                if delivery_time_mins <= 30:
                    rating_probs = [0.01, 0.02, 0.07, 0.25, 0.65] # Heavily 5 star
                elif delivery_time_mins <= 40:
                    rating_probs = [0.02, 0.05, 0.13, 0.45, 0.35] # Mostly 4 star
                elif delivery_time_mins <= 55:
                    rating_probs = [0.10, 0.15, 0.35, 0.30, 0.10] # Mostly 3 star
                else:
                    rating_probs = [0.50, 0.25, 0.15, 0.07, 0.03] # Heavily 1/2 star
                    
                rating = int(np.random.choice([1, 2, 3, 4, 5], p=rating_probs))
                
        # Generate Restaurant details
        restaurant_names_by_cuisine = {
            'North Indian': ['Dhaba Express', 'Pind Balluchi', 'Tandoori Nights', 'Moti Mahal', 'Shanti Dhaba'],
            'Biryani': ['Behrouz Biryani', 'Paradise Biryani', 'Biryani Blues', 'Mehfil', 'Charminar Bites'],
            'South Indian': ['Sagar Ratna', 'MTR', 'Saravana Bhavan', 'Idli Factory', 'Dakshin Delight'],
            'Fast Food': ['Burger Singh', 'Pizza Hut', 'KFC', 'Subway Corner', 'Waffle Lust'],
            'Chinese': ['Mainland China', 'Wok Express', 'Chinatown', 'Dragon Bowl', 'The Noodle Theory'],
            'Desserts': ['Baskin Robbins', 'Natural Ice Cream', 'The Belgian Waffle', 'Sweet Truth', 'Corner House']
        }
        
        restaurant = random.choice(restaurant_names_by_cuisine[category])
        
        data.append({
            'order_id': f"ORDR_{100000 + i}",
            'customer_id': customer,
            'restaurant_name': restaurant,
            'cuisine_category': category,
            'city': city,
            'order_value_inr': order_value,
            'order_time': order_time.strftime('%Y-%m-%d %H:%M:%S'),
            'delivered_time': delivered_time.strftime('%Y-%m-%d %H:%M:%S') if delivered_time else None,
            'status': status,
            'cancellation_reason': cancel_reason if status == 'Cancelled' else None,
            'rating': rating,
            'delivery_person_id': rider if status == 'Delivered' else None,
            'delivery_distance_km': distance,
            'delivery_duration_mins': delivery_time_mins
        })
        
    df = pd.DataFrame(data)
    # Sort by order_time
    df = df.sort_values(by='order_time').reset_index(drop=True)
    
    # Save to CSV
    filename = 'orders_raw.csv'
    df.to_csv(filename, index=False)
    print(f"Dataset generated and saved to {filename} with {len(df)} orders.")
    return df

if __name__ == "__main__":
    generate_orders_dataset()
