import React, { useEffect, useState } from "react";
import axios from "axios";
import io from "socket.io-client";
import { getBaseURL } from "../apiConfig";
import "./OrderDetails.scss";

const socket = io(getBaseURL()); // Initialize socket connection

const OrderDetails = (props) => {
  const orderId = props.orderId;
  const [order, setOrder] = useState({});
  const [productsInOrder, setProductsInOrder] = useState([]);
  const [orderStatus, setOrderStatus] = useState("");

  const statusOptions = ["Pending", "Processing", "Shipped", "Delivered"];

  useEffect(() => {
    axios
      .get(`${getBaseURL()}api/orders/${orderId}`)
      .then((res) => {
        setOrder(res.data[0]);
        setOrderStatus(res.data[0]?.status || "Pending"); // Default to "Pending"
      })
      .catch((err) => console.log("Error fetching order details"));

    axios
      .get(`${getBaseURL()}api/orders/getProductsByOrder/${orderId}`)
      .then((res) => {
        setProductsInOrder(res.data);
      })
      .catch((err) => console.log("Error fetching products"));

    // Listen for order status updates from the server
    socket.on("orderStatusUpdated", (updatedOrder) => {
      if (updatedOrder.orderId === orderId) {
        setOrderStatus(updatedOrder.status);
      }
    });

    return () => {
      socket.off("orderStatusUpdated");
    };
  }, [orderId]);

  const handleStatusChange = (newStatus) => {
    setOrderStatus(newStatus);
    socket.emit("updateOrderStatus", { orderId, status: newStatus });
  };

  const handleBackClick = () => {
    props.onBackClick();
  };

  return (
    <div className="order-details-container">
      <div className="back-button-container">
        <button onClick={handleBackClick}>Back</button>
      </div>

      <div>
        <label>Order Id</label>
        <input type="text" value={orderId} disabled />
      </div>
      <div>
        <label>Customer Name</label>
        <input type="text" value={order.fname} disabled />
      </div>
      <div>
        <label>Total Cost</label>
        <input type="text" value={order.totalPrice} disabled />
      </div>
      <div>
        <label>Order Date</label>
        <input type="text" value={order.createdDate} disabled />
      </div>
      <div>
        <label>Address</label>
        <input type="text" value={order.address} disabled />
      </div>

      <div>
        <h2>Set Order Status</h2>
        <div className="status-options">
          {statusOptions.map((status) => (
            <label key={status} className="status-label">
              <input
                type="radio"
                name="orderStatus"
                value={status}
                checked={orderStatus === status}
                onChange={() => handleStatusChange(status)}
              />
              {status}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h1>Products In the Order</h1>
        <table>
          <thead>
            <tr>
              <th>Product Id</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Total Price</th>
            </tr>
          </thead>
          <tbody>
            {productsInOrder.map((product) => (
              <tr key={product.productId}>
                <td>{product.productId}</td>
                <td>{product.name}</td>
                <td>{product.quantity}</td>
                <td>{product.totalPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderDetails;
