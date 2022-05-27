import table from "./table.scss"
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';


const List = () => {
    const rows = [
        {
            id: 224491,
            product:"Huile 10L",
            img: "../../images/1.jpeg",
            customer: "Sow",
            date: "1 March",
            amount: 785,
            method: "Cash on Delivery",
            status: "Approved"
        },
        {
            id: 224493,
            product:"Huile 1L",
            img: "../../images/3.jpeg",
            customer: "Barry",
            date: "1 September",
            amount: 75,
            method: "Online payment",
            status: "Pending"
        },
        {
            id: 224495,
            product:"Riz 50kg",
            img: "../../images/5.jpeg",
            customer: "Diallo",
            date: "1 March",
            amount: 900,
            method: "Online Payment",
            status: "Approved"
        },
        {
            id: 224496,
            product:"Sucre 50kg",
            img: "../../images/6.jpeg",
            customer: "Bah",
            date: "1 April",
            amount: 1200,
            method: "Cash on Delivery",
            status: "Pending"
        } 
    ];
  return (
    <TableContainer component={Paper} className="table" >
    <Table sx={{ minWidth: 700 }} aria-label="customized table">
      <TableHead>
        <TableRow>
          <TableCell className="tableCell">Tracking ID</TableCell>
          <TableCell className="tableCell">Product</TableCell>
          <TableCell className="tableCell">Custumer</TableCell>
          <TableCell className="tableCell">Date</TableCell>
          <TableCell className="tableCell">Amount</TableCell>
          <TableCell className="tableCell">Payment Method</TableCell>
          <TableCell className="tableCell">Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="tableCell">{row.id}</TableCell>
            <TableCell className="tableCell">
              <div className="cellWrapper">
                <img src={row.img} alt="" className="image" />
                {row.product}
              </div>
            </TableCell>
            <TableCell className="tableCell">{row.customer}</TableCell>
            <TableCell className="tableCell">{row.date}</TableCell>
            <TableCell className="tableCell">{row.amount}</TableCell>
            <TableCell className="tableCell">{row.method}</TableCell>
            <TableCell className="tableCell">
              <span className={`status ${row.status}`} >{row.status}</span>
              </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
  )
}

export default List