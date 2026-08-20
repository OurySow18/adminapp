import "./reviews.scss";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { format, isValid, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import { db } from "../../firebase";

const RATING_FILTERS = [5, 4, 3, 2, 1];
const COMMENT_FILTERS = [
  { value: "all", label: "Tous" },
  { value: "withComment", label: "Avec commentaire" },
  { value: "withoutComment", label: "Sans commentaire" },
];
const SORT_OPTIONS = [
  { value: "recent", label: "Plus récents" },
  { value: "oldest", label: "Plus anciens" },
  { value: "ratingDesc", label: "Meilleure note" },
  { value: "ratingAsc", label: "Moins bonne note" },
];

const toDate = (value) => (typeof value?.toDate === "function" ? value.toDate() : null);

const formatDateTime = (value) => {
  const date = toDate(value);
  return date ? format(date, "dd/MM/yyyy HH:mm") : "—";
};

const parseDateInput = (value, endOfDay = false) => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const Stars = ({ rating }) => (
  <span className="reviews__stars" aria-label={`${rating} sur 5`}>
    {"★".repeat(rating)}
    <span className="reviews__stars--empty">{"★".repeat(5 - rating)}</span>
  </span>
);

const Reviews = () => {
  const [ratingFilter, setRatingFilter] = useState("all");
  const [commentFilter, setCommentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [sortOption, setSortOption] = useState("recent");
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

  const hasActiveFilters =
    ratingFilter !== "all" ||
    commentFilter !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(searchText.trim());

  const resetFilters = () => {
    setRatingFilter("all");
    setCommentFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchText("");
  };

  const filteredReviews = useMemo(() => {
    const fromDate = parseDateInput(dateFrom, false);
    const toDateValue = parseDateInput(dateTo, true);
    const normalizedSearch = searchText.trim().toLowerCase();

    const filtered = reviews.filter((review) => {
      if (ratingFilter !== "all" && Number(review.rating) !== Number(ratingFilter)) {
        return false;
      }

      const hasComment = Boolean(review.comment && review.comment.trim());
      if (commentFilter === "withComment" && !hasComment) return false;
      if (commentFilter === "withoutComment" && hasComment) return false;

      if (fromDate || toDateValue) {
        const createdAt = toDate(review.createdAt);
        if (!createdAt) return false;
        if (fromDate && createdAt < fromDate) return false;
        if (toDateValue && createdAt > toDateValue) return false;
      }

      if (normalizedSearch) {
        const haystack = [review.comment, review.orderId, review.userId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortOption === "ratingDesc") return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (sortOption === "ratingAsc") return (Number(a.rating) || 0) - (Number(b.rating) || 0);
      const aTime = toDate(a.createdAt)?.getTime() ?? 0;
      const bTime = toDate(b.createdAt)?.getTime() ?? 0;
      return sortOption === "oldest" ? aTime - bTime : bTime - aTime;
    });

    return sorted;
  }, [reviews, ratingFilter, commentFilter, dateFrom, dateTo, searchText, sortOption]);

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

        <div className="reviews__filterBar">
          <div className="reviews__field">
            <label htmlFor="reviews-search">Recherche</label>
            <input
              id="reviews-search"
              type="text"
              placeholder="Commentaire, commande, client..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div className="reviews__field">
            <label htmlFor="reviews-date-from">Du</label>
            <input
              id="reviews-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="reviews__field">
            <label htmlFor="reviews-date-to">Au</label>
            <input
              id="reviews-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="reviews__field">
            <label htmlFor="reviews-comment-filter">Commentaire</label>
            <select
              id="reviews-comment-filter"
              value={commentFilter}
              onChange={(event) => setCommentFilter(event.target.value)}
            >
              {COMMENT_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="reviews__field">
            <label htmlFor="reviews-sort">Trier par</label>
            <select
              id="reviews-sort"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button type="button" className="reviews__reset" onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          )}
        </div>

        <p className="reviews__resultCount">
          {filteredReviews.length} avis {hasActiveFilters ? "(filtrés)" : ""}
        </p>

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
