import "./reviews.scss";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db } from "../../firebase";

const RATING_FILTERS = [5, 4, 3, 2, 1];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : null;
  return date ? format(date, "dd/MM/yyyy HH:mm") : "—";
};

const Stars = ({ rating }) => (
  <span className="reviews__stars" aria-label={`${rating} sur 5`}>
    {"★".repeat(rating)}
    <span className="reviews__stars--empty">{"★".repeat(5 - rating)}</span>
  </span>
);

const Reviews = () => {
  const [ratingFilter, setRatingFilter] = useState("all");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const reviewsQuery = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        setReviews(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
        setError(false);
      },
      (err) => {
        console.error("Failed to load reviews:", err);
        setLoading(false);
        setError(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredReviews = useMemo(() => {
    if (ratingFilter === "all") return reviews;
    return reviews.filter((review) => Number(review.rating) === Number(ratingFilter));
  }, [reviews, ratingFilter]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return null;
    const sum = reviews.reduce((acc, review) => acc + (Number(review.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  return (
    <div className="reviews">
      <Sidebar />
      <main className="reviews__container">
        <Navbar />
        <header className="reviews__header">
          <div>
            <h1>Avis clients</h1>
            <p>Avis laissés par les clients après réception de leur commande.</p>
          </div>
          <div className="reviews__stats">
            <div>
              <span>Total</span>
              <strong>{reviews.length}</strong>
            </div>
            <div>
              <span>Note moyenne</span>
              <strong>{averageRating !== null ? averageRating.toFixed(1) : "—"}</strong>
            </div>
          </div>
        </header>

        <div className="reviews__filters">
          <button
            type="button"
            className={ratingFilter === "all" ? "active" : ""}
            onClick={() => setRatingFilter("all")}
          >
            Toutes
          </button>
          {RATING_FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              className={ratingFilter === value ? "active" : ""}
              onClick={() => setRatingFilter(value)}
            >
              {value} ★
            </button>
          ))}
        </div>

        {error && (
          <div className="reviews__banner reviews__banner--error">
            Impossible de charger les avis.
          </div>
        )}

        <section className="reviews__panel">
          {loading && <p className="reviews__empty">Chargement...</p>}
          {!loading && !filteredReviews.length && (
            <p className="reviews__empty">Aucun avis pour le moment.</p>
          )}
          {!loading && filteredReviews.length > 0 && (
            <table className="reviews__table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Commentaire</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <Stars rating={Number(review.rating) || 0} />
                    </td>
                    <td className="reviews__comment">
                      {review.comment || <span className="reviews__empty">—</span>}
                    </td>
                    <td>
                      {review.orderId ? (
                        <Link to={`/delivredOrders/${review.orderId}`}>
                          {review.orderId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {review.userId ? (
                        <Link to={`/users/${review.userId}`}>{review.userId}</Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDateTime(review.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
};

export default Reviews;
