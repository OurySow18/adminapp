import { format } from "date-fns";

// Fonction de formattage personnalisée pour le timestamp
const formatDate = (timestamp) => {
  return format(timestamp.toDate(), "dd/MM/yyyy HH:mm:ss");
};

export const userColumns = [
    { field: "id", headerName: "ID", width: 70 }, 
    {
      field: "surname",
      headerName: "Nom",
      width: 190,
    },
    {
      field: "email",
      headerName: "Email",
      width: 230,
    },
  
    {
      field: "signInMethod",
      headerName: "Connexion",
      width: 100,
    },

    {
      field: "timeStamp",
      headerName: "Date & Heure",
      width: 180,
      valueGetter: (params) => formatDate(params.row.timeStamp),
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
      headerName: "Prix Detail",
      width: 100,
    },
    {
      field: "priceWholesale",
      headerName: "Prix en Gros",
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
    { field: "orderId", headerName: "ID", width: 90 },     
    {
      field: "mail_invoice",
      headerName: "Email",
      width: 300, 
    },
    {
      field: "deliverInfos.recipientName",
      headerName: "Nom du recepteur",
      width: 230,
      valueGetter: (params) => params.row.deliverInfos.name,
    },
    {
      field: "deliverInfos.adresse",
      headerName: "Adresse de livraison",
      width: 200,
      valueGetter: (params) => params.row.deliverInfos.address,
    },
    {
      field: "deliverInfos.phone",
      headerName: "Telephone",
      width: 100,
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
 
export const gameColumns = [
  { field: "id", headerName: "ID (Firestore)", width: 250 },
  {
    field: "code",
    headerName: "Code",
    width: 120,
  },     
  {
      field: "createdByEmail",
      headerName: "Email",
      width: 300, 
  },
  {
    field: "pseudo",
    headerName: "Pseudo",
    width: 180,
  },
  {
    field: "points",
    headerName: "Points",
    width: 100,
  },
  {
    field: "usedBy",
    headerName: "Utilisateurs",
    width: 150,
    valueGetter: (params) => params.row.usedBy?.length || 0,
  },
  {
    field: "createdAt",
    headerName: "Créé le",
    width: 200,
    valueGetter: (params) => formatDate(params.row.createdAt),
  }, 
];
