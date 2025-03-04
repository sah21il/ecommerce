import React, { useEffect, useState } from "react";
import axios from "axios";
import { getBaseURL } from "../apiConfig";
import "./CustomerOrders.scss";

// OrderStatusBar component
const OrderStatusBar = ({ status }) => {
  // Define possible statuses and their order
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered'];
  
  // Find the index of the current status
  const currentStatusIndex = statuses.indexOf(status) !== -1 
    ? statuses.indexOf(status) 
    : 0; // Default to Pending if status not found
  
  return (
    <div className="order-status-container">
      <div className="status-text">Status: <strong>{status || 'Pending'}</strong></div>
      <div className="status-bar">
        {statuses.map((statusStep, index) => (
          <React.Fragment key={statusStep}>
            <div 
              className={`status-step ${index <= currentStatusIndex ? 'completed' : ''}`}
            >
              <div className="status-circle"></div>
              <div className="status-label">{statusStep}</div>
            </div>
            {index < statuses.length - 1 && (
              <div 
                className={`status-line ${index < currentStatusIndex ? 'completed' : ''}`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const CustomerOrders = (props) => {
  const [pastOrders, setPastOrders] = useState([]);
  const [groupedOrders, setGroupedOrders] = useState({});
  const customerId = sessionStorage.getItem("customerId");

  useEffect(() => {
    axios
      .get(`${getBaseURL()}api/orders/myPastOrders/${customerId}`)
      .then((res) => {
        setPastOrders(res.data);
        
        // Group orders by orderId for status display
        const grouped = {};
        res.data.forEach(order => {
          if (!grouped[order.orderId]) {
            grouped[order.orderId] = {
              orderId: order.orderId,
              status: order.status || 'Pending',
              products: []
            };
          }
          
          grouped[order.orderId].products.push(order);
        });
        
        setGroupedOrders(grouped);
      })
      .catch((err) => {
        console.log("error", err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="customer-orders-container">
      <h1>My Orders</h1>
      
      {Object.keys(groupedOrders).length > 0 ? (
        Object.values(groupedOrders).map(orderGroup => (
          <div key={orderGroup.orderId} className="order-group">
            <h2>Order #{orderGroup.orderId}</h2>
            <OrderStatusBar status={orderGroup.status} />
            
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Order Date</th>
                  <th>Quantity</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {orderGroup.products.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{product.createdDate}</td>
                    <td>{product.quantity}</td>
                    <td>{product.totalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <div>
          <table>
            <thead>
              <tr>
                <th>Order Id</th>
                <th>Product Name</th>
                <th>Order Date</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pastOrders.map((order) => {
                return (
                  <tr key={`${order.orderId}-${order.name}`}>
                    <td>{order.orderId}</td>
                    <td>{order.name}</td>
                    <td>{order.createdDate}</td>
                    <td>{order.quantity}</td>
                    <td>{order.totalPrice}</td>
                    <td>{order.status || 'Pending'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CustomerOrders;
