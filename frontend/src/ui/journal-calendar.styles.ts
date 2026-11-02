import { css } from "lit";

export const calendarStyles = css`
  :host {
    display: block;
    min-width: 0;
    container: journal-calendar / inline-size;
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
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: center;
    font-size: 20px;
  }
  .calendar-scroll {
    overflow-x: auto;
  }
  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    width: 100%;
    min-width: 0;
  }
  .weekday {
    text-align: center;
    padding: 8px;
    font-weight: 600;
    color: var(--muted);
  }
  .day {
    position: relative;
    padding: 5px;
    min-height: 0;
    height: var(--calendar-day-size);
    border-top: 1px solid var(--line);
    border-inline-end: 1px solid var(--line);
  }
  .day.other-month {
    opacity: 0.35;
  }
  .day time {
    position: absolute;
    inset-block-start: 5px;
    inset-inline-start: 5px;
    z-index: 2;
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--surface);
    pointer-events: none;
    font-size: 12px;
  }
  .day.today time {
    color: var(--accent);
    font-weight: 700;
  }
  .cover-stack {
    position: absolute;
    inset: 5px;
    inset-block-end: auto;
    aspect-ratio: 2 / 3;
    width: min(
      calc(100% - 10px),
      calc((var(--calendar-day-size) - 11px) * 2 / 3)
    );
    margin-inline: auto;
    isolation: isolate;
  }
  .poster {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    width: calc(100% / var(--spread));
    height: calc(100% / var(--spread));
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
  .poster-art {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .poster-start .poster-art {
    clip-path: polygon(0 0, 100% 0, 100% 67%, 0 100%);
  }
  .poster-completion .poster-art {
    clip-path: polygon(0 33%, 100% 0, 100% 100%, 0 100%);
  }
  .poster-start,
  .poster-completion {
    background: transparent;
    box-shadow: none;
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
  .calendar-dialog {
    width: min(760px, calc(100% - 32px));
  }
  .calendar-dialog .card-head {
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
  @container journal-calendar (max-width: 560px) {
    .month-bar {
      gap: 6px;
      padding: 10px;
    }
    .month-bar h2 {
      font-size: 16px;
    }
    .month-bar button {
      flex: none;
      padding: 8px;
      min-width: 40px;
    }
    .weekday {
      padding: 6px 2px;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  @media (max-width: 600px) {
    .month-grid {
      min-width: 0;
    }
    .weekday,
    .day {
      padding-inline: 3px;
    }
    .weekday {
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .movie-detail {
      display: flow-root;
      margin-top: 12px;
      font-size: 13px;
    }
    .movie-detail > div {
      display: contents;
    }
    .movie-detail > kaleidescape-library-cover {
      float: left;
      width: 100px;
      height: 150px;
      margin: 0 12px 10px 0;
    }
    .month-bar {
      gap: 6px;
      padding: 12px;
    }
    .month-bar h2 {
      font-size: 16px;
    }
  }
  @media (max-width: 380px) {
    .movie-detail > kaleidescape-library-cover {
      width: 72px;
      height: 108px;
      margin-inline-end: 10px;
    }
  }
`;
