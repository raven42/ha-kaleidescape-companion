import { css } from "lit";

export const calendarStyles = css`
  :host {
    display: block;
  }
  .month-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px 20px;
  }
  .month-bar h2 {
    margin: 0;
    flex: 1;
    text-align: center;
    font-size: 20px;
  }
  .calendar-scroll {
    overflow-x: auto;
  }
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    min-width: 560px;
  }
  .weekday {
    text-align: center;
    padding: 8px;
    font-weight: 600;
    color: var(--muted);
  }
  .day {
    padding: 6px;
    min-height: 0;
    height: var(--calendar-day-size);
    border-top: 1px solid var(--line);
    border-inline-end: 1px solid var(--line);
  }
  .day.other-month {
    opacity: 0.35;
  }
  .day time {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 12px;
  }
  .day.today time {
    color: var(--accent);
    font-weight: 700;
  }
  .cover-stack {
    position: relative;
    width: min(100%, calc((var(--calendar-day-size) - 32px) * 2 / 3));
    margin-inline: auto;
    aspect-ratio: 2 / 3;
    isolation: isolate;
  }
  .poster {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    width: calc(100% / var(--spread));
    aspect-ratio: 2 / 3;
    min-height: 0;
    transform: translate(calc(var(--index) * 15%), calc(var(--index) * 15%));
    z-index: var(--layer);
    padding: 0;
    border: 0;
    border-radius: 4px;
    box-shadow: 0 1px 5px #0008;
    overflow: hidden;
    transition: box-shadow 0.12s;
  }
  .poster:hover,
  .poster:focus-visible {
    z-index: 1100;
    outline: 2px solid var(--accent);
    box-shadow: 0 2px 8px #000c;
  }
  kaleidescape-library-cover {
    width: 100%;
    height: 100%;
  }
  .poster-title {
    position: absolute;
    bottom: 0;
    inset-inline: 0;
    padding: 3px;
    font-size: 10px;
    background: #000b;
    color: white;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .month-status {
    color: var(--muted);
    padding: 12px 20px;
    margin: 0;
    font-size: 12px;
  }
  .calendar-dialog {
    width: min(760px, calc(100% - 32px));
  }
  .calendar-dialog .card-head {
    padding: 0;
    align-items: start;
    gap: 16px;
  }
  .calendar-dialog h2 {
    overflow-wrap: anywhere;
  }
  .movie-detail {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 20px;
    margin-top: 20px;
  }
  .movie-detail > kaleidescape-library-cover {
    height: 210px;
    border-radius: 6px;
  }
  .movie-detail p {
    overflow-wrap: anywhere;
  }
  @media (max-width: 600px) {
    .movie-detail {
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 12px;
    }
    .movie-detail > kaleidescape-library-cover {
      height: 150px;
    }
    .month-bar {
      gap: 6px;
      padding: 12px;
    }
    .month-bar h2 {
      font-size: 16px;
    }
  }
`;
