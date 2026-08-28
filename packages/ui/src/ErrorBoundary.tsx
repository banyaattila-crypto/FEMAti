import { Component, type ErrorInfo, type ReactNode } from 'react';
import './errorBoundary.css';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Utolsó védelmi vonal váratlan render-idejű kivételek ellen. Enélkül egy
 * kezeletlen React-hiba (pl. egy szélsőséges numerikus eset NaN/Infinity-t
 * termel, amit egy formázó komponens nem véd ki) a TELJES fát lebontja —
 * a felhasználó egy üres, fehér oldalt lát, minden visszajelzés nélkül, és
 * fogalma sincs, mentette-e a munkáját.
 *
 * KORLÁT (React szabály): csak render/lifecycle hibákat fog el. Async
 * hibákat (Promise `.catch`, event handler try/catch hiánya) NEM — azokat
 * a hívóhelyükön kell kezelni (ld. pl. `DerivationView.tsx`
 * `handleExportDocx` saját `.catch`-e).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('FEMAti — kezeletlen render-hiba:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div className="vem-error-boundary">
        <div className="vem-error-boundary__box">
          <h1>Váratlan hiba történt</h1>
          <p>
            A felület egy nem kezelt hibába ütközött, ezért nem tud tovább biztonságosan működni. A
            jelenlegi modell-állapot ELVESZHETETT az újratöltéskor — ha fontos beállítást szerkesztettél,
            jegyezd fel, mielőtt újratöltöd.
          </p>
          <details className="vem-error-boundary__details">
            <summary>Technikai részletek</summary>
            <pre>{error.message}</pre>
          </details>
          <button type="button" className="vem-btn vem-btn--primary" onClick={() => window.location.reload()}>
            Oldal újratöltése
          </button>
        </div>
      </div>
    );
  }
}
