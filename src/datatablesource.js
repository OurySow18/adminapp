/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Einstellung Daten für unser Table
 */
import { format } from "date-fns";

// Fonction de formattage personnalisée pour le timestamp
const formatDate = (timestamp) => {
  return format(timestamp.toDate(), "dd/MM/yyyy HH:mm:ss");
};

export const userColumns = [
    { field: "id", headerName: "ID", width: 270 },
    /*{
      field: "user",
      headerName: "User",
      width: 230,
      renderCell: (params) => {
        return (
          <div className="cellWithImg">
            <img className="cellImg" src={params.row.image} alt="avatar" />
            {params.row.username}
          </div>
        );
      },
    },*/
    {
      field: "surname",
      headerName: "Nom",
      width: 350,
    },
    {
      field: "email",
      headerName: "Email",
      width: 230,
    },
  
    {
      field: "adresse",
      headerName: "Adresse",
      width: 250,
    },
    {
      field: "category",
      headerName: "Category",
      width: 100,
    },
    {
      field: "status",
      headerName: "Status",
      width: 160,      
    },
  ];

export const productColumns = [
    { field: "product_id", headerName: "ID", width: 100 },
    {
      field: "product",
      headerName: "Product",
      width: 100,
      renderCell: (params) => {
        return (
          <div className="cellWithImg">
            <img className="cellImg" src={params.row.img} alt="avatar" />
            {params.row.title}
          </div>
        );
      },
    },
    {
      field: "name",
      headerName: "Name",
      width: 230,
    },
    {
      field: "description",
      headerName: "Description",
      width: 230,
    },
  
    {
      field: "category",
      headerName: "Category",
      width: 100,
    },
    {
      field: "price",
      headerName: "Price",
      width: 100,
    },
    {
      field: "status",
      headerName: "Status",
      width: 160,      
    },
  ];
  
export const zonesColumns = [
    { field: "id", headerName: "ID", width: 270 },
    {
      field: "zoneName",
      headerName: "Zones",
      width: 100, 
    },
    {
      field: "priceZoneMinimum",
      headerName: "Prix minimum",
      width: 230,
    },
    {
      field: "priceZoneMaximum",
      headerName: "Prix maximum",
      width: 230,
    },
  
    {
      field: "createdAt",
      headerName: "Creation",
      width: 100,
    },
    {
      field: "updatedAt",
      headerName: "Modification",
      width: 100,
    },
    {
      field: "status",
      headerName: "Status",
      width: 160,      
    },
  ];
  

export const orderColumns = [
    { field: "orderId", headerName: "Commande ID", width: 200 },     
    {
      field: "deliverInfos.recipientName",
      headerName: "Nom du recepteur",
      width: 230,
      valueGetter: (params) => params.row.deliverInfos.recipientName,
    },
    {
      field: "deliverInfos.adresse",
      headerName: "Adresse de livraison",
      width: 200,
      valueGetter: (params) => params.row.deliverInfos.adresse,
    },
    {
      field: "deliverInfos.phone",
      headerName: "Telephone de livraison",
      width: 180,
      valueGetter: (params) => params.row.deliverInfos.phone,
    },
    {
      field: "timeStamp",
      headerName: "Date & Heure",
      width: 180,
      valueGetter: (params) => formatDate(params.row.timeStamp),
    },
  
    {
      field: "paymentType",
      headerName: "Type de Payement",
      width: 150,
    },
    {
      field: "total",
      headerName: "Total",
      width: 150,
    },
     ];
  
