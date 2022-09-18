/**
 * Abgabe Bachelorarbeit
 * Author: Amadou Oury Sow
 * Date: 15.09.2022
 * 
 * Einstellung Daten für unser Table
 */
export const userColumns = [
    { field: "id", headerName: "ID", width: 70 },
    {
      field: "user",
      headerName: "User",
      width: 230,
      renderCell: (params) => {
        return (
          <div className="cellWithImg">
            <img className="cellImg" src={params.row.img} alt="avatar" />
            {params.row.username}
          </div>
        );
      },
    },
    {
      field: "email",
      headerName: "Email",
      width: 230,
    },
  
    {
      field: "addresse",
      headerName: "Addresse",
      width: 150,
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
    { field: "id", headerName: "ID", width: 100 },
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
  
