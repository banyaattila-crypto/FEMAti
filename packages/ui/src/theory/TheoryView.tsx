/**
 * „Elmélet" nézet — MASTER-PROMPT-TERV P18 prompt 6. pontja: "Beépített
 * „Elmélet" nézet a felületen: a dokumentumok (`docs/THEORY.md` stb.)
 * olvashatók az appban, a képletek KaTeX-szel szedve."
 *
 * A tartalom a `docs/THEORY.md`-ből származik (nem önálló forrás) — ha egy
 * képlet vagy oldalszám itt megváltozik, a THEORY.md-t is frissíteni kell,
 * és fordítva. A „Történelmi mód" (P17, `historical/HistoricalView.tsx`) a
 * frontális megoldó ANIMÁLT bemutatóját adja; ez a nézet a statikus
 * elméleti hátteret (képletek, oldalszám-hivatkozások).
 *
 * HU/EN nyelvváltó (2026-09-04, felhasználói kérés): a publikus GitHub-repó
 * nem magyar látogatói ne csak a README-marketingszöveget kapják, hanem az
 * elméleti tartalmat is. Kezdetben ez egy elszigetelt, csak-erre-az-5-fülre
 * szóló váltó volt; 2026-09-05-től a nyelv globális (`appStore.ts` `lang`
 * mező), a header (`App.tsx`) mindig látható HU/EN váltóján keresztül —
 * ez a nézet már csak OLVASSA az `s.lang`-ot, saját váltót nem mutat. A
 * `CONTENT` ezért nyelvenként külön rekord; a képletek (`Formula tex=...`)
 * nyelvfüggetlenek, nem duplikáltak.
 */
import './theory.css';
import { Formula } from '../derivation/Formula.js';
import { Logo } from '../components/Logo.js';
import { useAppStore, type Lang, type TheoryTopic } from '../state/appStore.js';

interface TopicContent {
  readonly title: string;
  readonly subtitle: string;
  readonly body: readonly JSX.Element[];
}

const TOPICS: readonly TheoryTopic[] = ['about', 'thesis96', 'timoshenko', 'integration', 'reforb'];

const STRINGS: Record<Lang, { readonly nav: string; readonly navAria: string; readonly navNote: string; readonly close: string }> = {
  hu: {
    nav: 'Elmélet',
    navAria: 'Elmélet témák',
    navNote: 'Teljes forrás: docs/THEORY.md',
    close: 'Bezárás',
  },
  en: {
    nav: 'Theory',
    navAria: 'Theory topics',
    navNote: 'Full source: docs/THEORY.md (Hungarian)',
    close: 'Close',
  },
};

function Ref({ children }: { readonly children: string }): JSX.Element {
  return <span className="vem-theory__ref">{children}</span>;
}

function Section({ num, title }: { readonly num: string; readonly title: string }): JSX.Element {
  return (
    <h3 className="vem-theory__section">
      <span className="vem-theory__section-num">{num}</span>
      {title}
    </h3>
  );
}

const CONTENT_HU: Record<TheoryTopic, TopicContent> = {
  thesis96: {
    title: 'Matematikai összefoglaló',
    subtitle: 'Teljes, következetes matematikai összefoglaló — kinematikától a rugalmas–képlékeny nemlineáris megoldóig',
    body: [
      <p key="intro">
        Ez az oldal a diplomaterv teljes mechanikai/numerikus levezetését egyetlen, egymásra
        épülő gondolatmenetként foglalja össze — a rövidebb „Timoshenko gerendaelem",
        „Szelektív redukált integrálás" és „Reziduális erők (REFORB)" oldalak EGY-EGY
        részletét mélyítik el; ez az oldal a TELJES láncot adja, elejétől a végéig, azonos
        jelölésrendszerrel. Minden képlet a <code>docs/THEORY.md</code> forrásával és a
        diplomaterv tényleges oldalszámával van hivatkozva.
      </p>,

      <Section key="s1" num="1." title="Kinematikai alapfeltevés és anyagtörvény" />,
      <p key="s1p1">
        A modell egyenes tengelyű, síkban hajlított gerenda, amelynek keresztmetszete a
        deformáció során SÍK marad, de — a klasszikus Bernoulli-elmélettel szemben — NEM
        marad merőleges az alakváltozott középvonalra. A keresztmetszet elfordulását (
        <em>φ</em>) és a középvonal iránytangensét (<em>dw/dx</em>) egymástól FÜGGETLEN
        szabadságfoknak tekinti; a kettő különbsége a nyírási torzulás (<em>γ</em>), a
        keresztmetszet elfordulásának x szerinti deriváltja pedig a görbület (<em>κ</em>):
      </p>,
      <Formula key="s1f1" tex="\gamma(x) = \varphi(x) - \frac{dw}{dx} \qquad \kappa(x) = \frac{d\varphi}{dx}" />,
      <p key="s1p2">
        <Ref>Diplomaterv (3.1), 3.1.1, 33. oldal.</Ref> Az anyagtörvény a hajlítást és a
        nyírást KÉT FÜGGETLEN rugóként kapcsolja össze — a hajlékonysági mátrix (
        <em>H</em>) és a merevségi mátrix (<em>D = H⁻¹</em>) diagonális, mert a modellben
        nincs hajlítás–nyírás csatolás:
      </p>,
      <Formula key="s1f2" tex="\begin{Bmatrix}\kappa\\\gamma\end{Bmatrix} = H \begin{Bmatrix}M\\T\end{Bmatrix},\quad H = \mathrm{diag}\!\left(\frac{1}{EI},\ \frac{1}{GA_s}\right) \qquad D = H^{-1} = \mathrm{diag}(EI,\ GA_s)" />,
      <p key="s1p3">
        <Ref>(2.1)–(2.3), 15. oldal.</Ref> Innen adódik a keresztmetszeti igénybevétel a
        alakváltozásokból: <code>M = EI·κ</code> (hajlítónyomaték), <code>T = GAs·γ</code>{' '}
        (nyíróerő) — ahol <em>GAs</em> a nyírási merevség, a nyírási alaktényezővel
        korrigálva (ld. 10. pont).
      </p>,

      <Section key="s2" num="2." title="Izoparametrikus elem és alakfüggvények" />,
      <p key="s2p1">
        Az elem 3 csomópontos (két végpont + felezőpont), a lokális koordináta{' '}
        <code>ξ ∈ [−1, 1]</code>, a csomópontok <code>ξ = −1, 0, +1</code> helyen. A
        kvadratikus Lagrange-alakfüggvények:
      </p>,
      <Formula
        key="s2f1"
        tex="N_1(\xi) = \tfrac12\xi(\xi-1) \qquad N_2(\xi) = 1-\xi^2 \qquad N_3(\xi) = \tfrac12\xi(\xi+1)"
      />,
      <p key="s2p2">
        <Ref>(3.4)–(3.6), 3.1.4, 37. oldal.</Ref> Az alakfüggvények KETTŐS szerepet
        játszanak (izoparametrikus formuláció): egyszerre írják le a geometria (a valódi{' '}
        <em>x</em> koordináta) ÉS az elmozdulásmező interpolációját a csomóponti
        értékekből:
      </p>,
      <Formula key="s2f2" tex="x(\xi) = \sum_{i=1}^{3} N_i(\xi)\cdot x_i" />,
      <p key="s2p3">
        <Ref>(3.10), 38. oldal.</Ref> A lokális és a valódi koordináta közötti átváltást a
        Jacobi-determináns adja; az elem csak akkor jól definiált (nem „csavarodott"), ha
        ez mindenütt pozitív:
      </p>,
      <Formula
        key="s2f3"
        tex="J = \frac{dx}{d\xi} = \sum_{i=1}^{3} \frac{dN_i}{d\xi}\cdot x_i \,,\qquad \det J \neq 0"
      />,
      <p key="s2p4">
        <Ref>(3.7)–(3.9), 37. oldal.</Ref> A láncszabály adja az alakfüggvények VALÓDI
        (x szerinti) deriváltját, amire a B mátrixhoz (3. pont) van szükség:
      </p>,
      <Formula key="s2f4" tex="\frac{dN_i}{dx} = \frac{dN_i}{d\xi}\cdot J^{-1}" />,
      <p key="s2p5"><Ref>(3.12)–(3.13), 38. oldal.</Ref></p>,

      <Section key="s3" num="3." title="B mátrix — alakváltozás-interpoláció" />,
      <p key="s3p1">
        A csomóponti elmozdulásvektor <code>uₑ = [w₁,φ₁,w₂,φ₂,w₃,φ₃]ᵀ</code> (6
        szabadságfok — mindhárom csomópontban egy-egy lehajlás ÉS elfordulás). A γ/κ
        alakváltozásokat az elmozdulásokból az 1. pont (3.1) kinematikájának x szerinti
        deriválásával, az alakfüggvények behelyettesítésével kapjuk — ez a B mátrix:
      </p>,
      <Formula
        key="s3f1"
        tex="B(\xi) = \begin{bmatrix} 0 & \tfrac{dN_1}{dx} & 0 & \tfrac{dN_2}{dx} & 0 & \tfrac{dN_3}{dx} \\[4pt] -\tfrac{dN_1}{dx} & N_1 & -\tfrac{dN_2}{dx} & N_2 & -\tfrac{dN_3}{dx} & N_3 \end{bmatrix}"
      />,
      <p key="s3p2">
        <Ref>(3.14)–(3.15), 39. oldal.</Ref> A felső sor a görbületet (κ), az alsó a
        nyírási torzulást (γ) állítja elő a csomóponti elmozdulásokból:{' '}
        <code>ε = B·uₑ</code>, ahol <code>ε = [κ, γ]ᵀ</code>.{' '}
        <Ref>(3.30), 45. oldal.</Ref>
      </p>,

      <Section key="s4" num="4." title="Numerikus integrálás és a nyírási záródás" />,
      <p key="s4p1">
        Az elemi mátrixok (5. pont) integrálját a <code>[−1,1]</code> tartományon
        Gauss–Legendre-kvadratúrával közelítjük:
      </p>,
      <Formula key="s4f1" tex="\int_{-1}^{1} f(\xi)\, d\xi \approx \sum_i a_i \cdot f(\xi_i)" />,
      <p key="s4p2">
        <Ref>(3.16)–(3.17), 39. oldal; súlytáblázat, 40. oldal.</Ref> Ha a hajlítási ÉS a
        nyírási tagot is UGYANAZZAL (a teljes, 3 pontos) sémával integráljuk, vékony
        (nagy karcsúságú) tartónál az elem mesterségesen túl merevvé válik —{' '}
        <strong>nyírási záródás</strong> (shear locking): a kvadratikus interpoláció nem
        tud pontosan nyírásmentes hajlítási állapotot reprodukálni, ezért parazita
        nyírási energia jelenik meg. A diplomaterv erre <strong>szelektív redukált
        integrálást</strong> alkalmaz: a hajlítási tag mindig 3 pontos (teljes), a
        nyírási tag alapértelmezésben 2 pontos (redukált) sémával integrálódik — ez
        szünteti meg a záródást. <Ref>3.1.4, szöveges indoklás.</Ref>
      </p>,

      <Section key="s5" num="5." title="Elemi merevségi mátrix" />,
      <p key="s5p1">A virtuális munka elve szerint az elemi merevségi mátrix:</p>,
      <Formula key="s5f1" tex="K_e = \int_{-1}^{1} B^{\mathsf T} D B \, |J| \, d\xi" />,
      <p key="s5p2">
        <Ref>(3.11), 3.1.5, 38. oldal; mátrixos kifejtés (3.24)–(3.26), 3.1.7, 43. oldal.</Ref>{' '}
        Mivel a hajlítási és a nyírási tag KÜLÖN kvadratúra-séma szerint integrálódik (4.
        pont), a kód két külön ciklusban építi fel — a végeredmény ugyanaz a 6×6-os,
        szimmetrikus <code>Kₑ</code> mátrix, amelynek nulltere pontosan a merevtest-mozgás
        (tiszta eltolás <code>w=1,φ=0</code> és merev elfordulás <code>w=x,φ=1</code>) —{' '}
        <code>Kₑ·u_rigid = 0</code>.
      </p>,

      <Section key="s6" num="6." title="Globális egyenletrendszer és peremfeltételek" />,
      <p key="s6p1">
        Az elemi mátrixok csomóponti szabadságfokok szerinti (<code>2i, 2i+1</code>{' '}
        globális index minden csomópontra) összeépítése (kompilálás) adja a szerkezeti
        egyenletrendszert:
      </p>,
      <Formula key="s6f1" tex="K \cdot v = q" />,
      <p key="s6p2">
        <Ref>(3.27), 43. oldal.</Ref> A <code>K</code> szimmetrikus és — megtámasztás
        nélkül — szinguláris (a szingularitás mértéke a szerkezet mechanizmus-fokával
        egyezik). A peremfeltételek (támaszok) kétféle úton érvényesíthetők:
        szabadságfok-elimináció, vagy egy nagy (~10¹⁰ kN/m) rugóállandó hozzáadása a
        főátlóhoz (<em>penalty</em>-módszer). <Ref>3.1.7.1/3.1.7.3, 43–44. oldal.</Ref>{' '}
        A Winkler-féle rugalmas ágyazat (ha van) egy külön, az alakfüggvényekből
        felépülő tagként adódik a merevségi mátrixhoz:
      </p>,
      <Formula key="s6f2" tex="K_{\text{ágy}} = \int N^{\mathsf T} \cdot c \cdot N \, dx" />,
      <p key="s6p3"><Ref>(3.28), 3.1.7.2, 44. oldal.</Ref></p>,

      <Section key="s7" num="7." title="Tehervektorok" />,
      <p key="s7p1">
        Az elemi tehervektor három forrásból tevődik össze: kezdeti alakváltozásból
        (hőteher), térfogati/felületi erőkből, és — külön kezelve — koncentrált
        csomóponti teherből:
      </p>,
      <Formula
        key="s7f1"
        tex="q_e = \int B^{\mathsf T} D \varepsilon_0\, dV \;+\; \int N^{\mathsf T} p\, dV \;+\; \int N^{\mathsf T} p\, dS"
      />,
      <p key="s7p2">
        <Ref>(3.19)–(3.21), 3.1.6, 40. oldal.</Ref> Koncentrált teher esetén az integrál
        egyszerű összeggé egyszerűsödik (<code>qₑᵢ = Σ Nᵢᵀ·pᵢ</code>,{' '}
        <Ref>(3.22), 41. oldal</Ref>), megoszló teher lineáris/parabolikus{' '}
        <code>q(x)</code>-re integrálódik (<Ref>3.1.6.2, 41. oldal</Ref>), önsúly a{' '}
        <code>p_z = γ·A</code> sűrűségi teherből (<Ref>(3.23), 42. oldal</Ref>), a
        hőteher pedig egy kezdeti görbületként (<em>κ0</em>) jelenik meg az
        alakváltozásban:
      </p>,
      <Formula key="s7f2" tex="\kappa_0 = \frac{\alpha\cdot(t_{\text{alsó}} - t_{\text{felső}})}{h} \,,\qquad \varepsilon_0 = [\kappa_0,\ 0]^{\mathsf T}" />,
      <p key="s7p3"><Ref>3.1.6.4, 42. oldal.</Ref></p>,

      <Section key="s8" num="8." title="Lineáris megoldás és utófeldolgozás" />,
      <p key="s8p1">
        A <code>K·v = q</code> egyenletrendszer megoldása (a diplomatervben Gauss-
        eliminációval, frontális algoritmussal — 18. pont; a mai kódban Skyline-LDLᵀ-vel)
        adja az elmozdulásokat. A visszahelyettesített igénybevétel — hőteherrel együtt —
        <code>M = EI·(κ − κ0)</code>. <Ref>3.1.7.4/1.6 pont, 45. oldal.</Ref> Mivel a
        feszültségeket (Gauss-pontokban) a csomópontokba kell kiírni, a diplomaterv
        egy másodfokú Lagrange-extrapolációt ír elő (a 3 Gauss-pont ÉS a 3 csomópont
        egyaránt 3 hely, tehát ez zárt alakban, elforgatás nélküli lineáris leképezés);
        elemhatáron a két szomszédos elem extrapolált értékét egyszerűen átlagolja.{' '}
        <Ref>3.1.7.4, 46. oldal.</Ref>
      </p>,

      <Section key="s9" num="9." title="Keresztmetszeti jellemzők és alaki tényező" />,
      <p key="s9p1">
        A rugalmas és a képlékeny keresztmetszeti modulus (utóbbi a súlyponti tengelyre
        vett statikai nyomaték kétszerese) adja az alaki tényezőt — a teljesen
        képlékeny és a rugalmas határnyomaték arányát:
      </p>,
      <Formula
        key="s9f1"
        tex="K_e = \frac{I}{y_{max}} \qquad K_p = 2\cdot S_0 \qquad c = \frac{K_p}{K_e}"
      />,
      <p key="s9p2">
        <Ref>(3.37), (3.39), 4. táblázat, 53–54. oldal.</Ref> A diplomaterv 4. táblázata
        szerint <code>c</code> téglalapra 1,50, körre 1,70, körgyűrűre (vékonyfalú
        határesetben) 1,27, zömök gerincű I-szelvényre 1,14–1,16 — ezeket a mai kód
        zárt alakban reprodukálja (ld. „A diplomatervről" oldal validáció-szakasza).
      </p>,

      <Section key="s10" num="10." title="Rugalmas–képlékeny anyagmodell — igénybevétel-szintű" />,
      <p key="s10p1">
        A dolgozat két, egymást kiegészítő képlékenységi modellt vezet be. Az
        egyszerűbb, <strong>igénybevétel-szintű</strong> modell a teljes keresztmetszetet
        EGYETLEN M–κ rugóként kezeli, zárt alakú folyási feltétellel. A teljesen
        képlékeny nyomatéki teherbírás:
      </p>,
      <Formula key="s10f1" tex="M_0 = \sigma_0 \cdot K_p" />,
      <p key="s10p2">
        <Ref>(3.47), 3.4.2, 62. oldal.</Ref> Az alakváltozás rugalmas és képlékeny
        részre bomlik (<code>dε = dε_e + dε_p</code>, <Ref>(3.48), 62. oldal</Ref>), a
        keményedési modulus a folyási felületen, terhelés közben mért nyomaték–
        alakváltozás meredekség (<code>H' = (dM/dε)</code>, terhelésnél,{' '}
        <code>f=0</code>-nál, <Ref>(3.49), 62. oldal</Ref>). Ebből adódik a tangens
        hajlítómerevség:
      </p>,
      <Formula key="s10f2" tex="EI_T = \frac{EI\cdot H'}{EI + H'}" />,
      <p key="s10p3">
        <Ref>(3.50)–(3.51), 63. oldal.</Ref> A nyírás ebben a modellben MINDIG rugalmas
        marad (<code>dQ = GAs·dγ</code>, <Ref>(3.52), 63. oldal</Ref>) — a folyási
        feltétel kizárólag a hajlítónyomatékra vonatkozik (<code>f = M² − M0²</code>).
      </p>,

      <Section key="s11" num="11." title="Rétegelt (fiber) keresztmetszet — a fő modell" />,
      <p key="s11p1">
        A dolgozat FŐ, ennél lényegesen finomabb modellje a keresztmetszetet vékony
        rétegekre (szálakra) bontja, és minden réteghez KÜLÖN egytengelyű
        rugalmas–képlékeny anyagtörvényt rendel — ez teszi lehetővé a képlékeny zóna
        keresztmetszeten BELÜLI, fokozatos terjedésének nyomon követését. A rétegzett
        merevségek:
      </p>,
      <Formula
        key="s11f1"
        tex="EI = \sum_l E_l \cdot b_l \cdot z_l^2 \cdot t_l \qquad GA = \sum_l G_l \cdot b_l \cdot t_l"
      />,
      <p key="s11p2">
        <Ref>(3.53)–(3.54), 3.4.3, 64. oldal.</Ref> A rétegenkénti feszültségekből a
        keresztmetszeti igénybevétel:
      </p>,
      <Formula key="s11f2" tex="M = \sum_l \sigma_{xl}\cdot b_l\cdot z_l\cdot t_l \qquad Q = \sum_l \tau_{xzl}\cdot b_l\cdot t_l" />,
      <p key="s11p3">
        <Ref>(3.59), 3.4.3.2, 65. oldal.</Ref> A rétegenkénti feszültség-visszavetítés — a
        dolgozatban REFORB néven — egy négyesetes döntési táblázat szerint dönti el
        rétegenként, hogy egy lépés rugalmas maradt-e, most lépett-e át a folyási
        határon, vagy már megfolyt anyagban folytatódik. A folyás UTÁNI hányad (
        <em>R</em>, az <code>AB/AC</code> arány a próba- és a tényleges
        feszültség-növekmény között) skálázza a képlékeny lépést:
      </p>,
      <Formula
        key="s11f3"
        tex="\Delta\sigma_{ep} = R\cdot\Delta\sigma_r\cdot\frac{E}{E+H'} \qquad \Delta\varepsilon_p = R\cdot\Delta\varepsilon_r\cdot\frac{E}{E+H'}"
      />,
      <p key="s11p4">
        <Ref>3.4.4, 3-10. ábra, 66–68. oldal.</Ref> A kiegyensúlyozott (a réteges
        feszültségekből visszaszámolt) csomóponti erő 3 pontos Gauss-integrálással:
      </p>,
      <Formula key="s11f4" tex="f = \int B^{\mathsf T}\sigma_r \, dx" />,
      <p key="s11p5"><Ref>(3.60), 68. oldal.</Ref></p>,

      <Section key="s12" num="12." title="Nemlineáris megoldó — increment-iteratív Newton–Raphson" />,
      <p key="s12p1">
        A dolgozat a nemlineáris egyenletrendszert (mind az igénybevétel-szintű, mind a
        rétegelt modellre) increment-iteratív Newton–Raphson eljárással oldja meg,
        teherlépcsőnként — 7 lépéses algoritmus: tehernövekmény felvétele, tangenciális
        merevségi mátrix (<em>K_T</em>) felépítése, egyenletrendszer megoldása (
        <em>Δu</em>), elmozdulás frissítése, belső erő újraszámolása a FRISSÍTETT
        anyagállapotból, reziduum-számítás, konvergencia-vizsgálat.
      </p>,
      <Formula key="s12f1" tex="\psi_i = K_T \cdot \Delta u_i \qquad u \leftarrow u + \Delta u_i" />,
      <p key="s12p2">
        <Ref>3.4.2.1/3.4.3.2, 65. oldal.</Ref> A reziduális (ki nem egyenlített) erő a
        FRISSÍTETT anyagállapotból (3 pontos Gauss) újraszámolt belső erő és a külső
        teher különbsége:
      </p>,
      <Formula key="s12f2" tex="\psi^{(e)} = p^{(e)} - f^{(e)} \,,\qquad p^{(e)} = \int B^{\mathsf T}\sigma\, dx" />,
      <p key="s12p3">
        A konvergenciát a CONUND-kritérium dönti el — a reziduális erők normájának és a
        külső terhek normájának hányadosa, százalékban:
      </p>,
      <Formula key="s12f3" tex="100 \cdot \frac{\sqrt{\sum \psi_i^2}}{\sqrt{\sum f_i^2}} \leq \text{Tolerancia}" />,
      <p key="s12p4">
        <Ref>3.4.2.1/6, 65. oldal.</Ref> A dolgozat azt is világosan kimondja, hogy a
        teher-vezérelt eljárás a teherbírási határ közelében DEFINÍCIÓ SZERINT elakad
        (a tangenciális merevség előjelet vált, szinguláris lesz) — ez fizikai korlát,
        nem hiba. A tehermentesítéskor minden réteg a rugalmas <em>E</em> meredekséggel
        tér vissza (nem a képlékeny <em>EI_T</em>-vel) — ez adja a maradó
        (saját)feszültségeket, és azt, hogy egy korábban elért terhelési szintre való
        ÚJRA-terhelés nem okoz újabb képlékeny alakváltozást (a „beállás", shakedown,
        jelensége).
      </p>,

      <Section key="s13" num="13." title="Lezárás" />,
      <p key="s13p1">
        Ez a 13 pont a diplomaterv teljes numerikus gerincét adja: a kinematikától (1.
        pont) a rétegelt, nemlineáris megoldóig (11–12. pont) — mindegyik lépés a mai
        kódban PONTOSAN azonosítható, tesztelt függvényként létezik, és mindegyikhez
        tartozik legalább egy validációs eset (zárt alak vagy kézzel számolt
        referencia). A részletesebb levezetés, a modulábra (a dolgozat eredeti FORTRAN-
        szerű modulnevei — <code>SFR1</code>, <code>JACOBI</code>, <code>MODB</code>,{' '}
        <code>STIFFB</code>, <code>FRONT</code>, <code>NONAL</code>, <code>REFORB</code>,{' '}
        <code>CONUND</code> stb. — és a mai megfelelőik), a mutációs próbák jegyzéke és a
        teljes validációs jegyzőkönyv a <code>docs/THEORY.md</code> és a{' '}
        <code>docs/VALIDATION.md</code> fájlokban érhető el.
      </p>,
      <p key="s13p2">
        A rövidebb almenük — „Timoshenko gerendaelem" (2–3. pont mélyebben), „Szelektív
        redukált integrálás" (4. pont mélyebben) és „Reziduális erők (REFORB)" (11–12.
        pont mélyebben) — ugyanezt az anyagot egyenként, részletesebben tárgyalják.
      </p>,
    ],
  },
  about: {
    title: 'A diplomatervről',
    subtitle: 'Bánya Attila: Rugalmas–képlékeny anyagú gerendaszerkezetek numerikus vizsgálata a végeselemes módszer segítségével (BME, 1996)',
    body: [
      <p key="p1">
        A FEMAti alapját Bánya Attila okl. szerkezetépítő mérnök 1996-ban, a Budapesti
        Műszaki Egyetem Építőmérnöki Karának Mechanika Tanszékén, dr. Bojtár Imre
        konzulens vezetésével készített diplomaterve adja. A dolgozat címe: „Rugalmas–
        képlékeny anyagú gerendaszerkezetek numerikus vizsgálata a végeselemes módszer
        segítségével" — a cél nem egy meglévő kereskedelmi program használata volt,
        hanem egy TELJES, saját fejlesztésű végeselemes szoftver megírása, a nulláktól:
        a modellalkotástól az egyenletrendszer megoldásán át a képlékeny alakváltozás
        nyomon követéséig.
      </p>,
      <p key="p2">
        A mechanikai mag egy háromcsomópontos, izoparametrikus, kvadratikus
        Timoshenko-gerendaelem — a klasszikus Bernoulli-elmélettel szemben ez a nyírási
        alakváltozást is figyelembe veszi, ami zömökebb (kisebb karcsúságú) tartóknál
        lényeges pontosságkülönbséget jelent. A dolgozat külön fejezetet szentel a
        „záródás" (shear locking) jelenségének és az ellene alkalmazott szelektív
        redukált integrálásnak — annak idején ez korántsem volt magától értetődő
        tervezési döntés, a numerikus problémát a szerzőnek explicit fel kellett
        ismernie és kezelnie.
      </p>,
      <p key="p3">
        Az egyenletrendszer megoldására a dolgozat a korabeli számítástechnikai
        korlátok (szűkös memória) miatt indokolt <strong>frontális algoritmust</strong>{' '}
        alkalmazza: a merevségi mátrix sosem áll elő teljes egészében — az elemek
        sorszáma szerint haladva, a már „lezárt" szabadságfokok folyamatosan
        kiküszöbölődnek, így a memóriaigényt a front pillanatnyi szélessége, nem a
        teljes szerkezet mérete szabja meg. A FEMAti ezt az eredeti algoritmust is
        megőrizte, „Történelmi mód" néven, animált bemutatóval.
      </p>,
      <p key="p4">
        A dolgozat legjelentősebb mérnöki hozzájárulása a rugalmas–képlékeny
        anyagmodell kétféle, egymást kiegészítő megvalósítása. Az egyszerűbb,
        igénybevétel-szintű modell a teljes keresztmetszet állapotát egyetlen
        nyomaték–görbület kapcsolattal írja le, zárt alakú folyási feltétellel — ez
        gyors, de csak a keresztmetszet EGÉSZÉNEK folyás-állapotát ismeri. A dolgozat
        fő modellje ennél lényegesen finomabb: a keresztmetszetet vékony rétegekre
        (szálakra) bontja, és minden réteghez KÜLÖN egytengelyű rugalmas–képlékeny
        anyagtörvényt rendel, keményedéssel is. Ez teszi lehetővé a képlékeny zóna
        keresztmetszeten BELÜLI, fokozatos terjedésének nyomon követését — nem csak
        azt, hogy „folyt-e", hanem azt is, hogy MENNYIRE.
      </p>,
      <p key="p5">
        A nemlineáris egyenletrendszert increment-iteratív Newton–Raphson eljárással
        oldja meg, teherlépcsőnként. Minden iterációban a próba-feszültségeket egy
        R-faktoros visszavetítési sémával (a dolgozatban „REFORB"-ként hivatkozva)
        vetíti vissza a folyási felületre — ez dönti el rétegenként, hogy egy adott
        lépés rugalmas maradt-e, most lépett-e át a folyási határon, vagy már korábban
        megfolyt anyagban folytatódik-e a képlékeny alakváltozás. A dolgozat egy
        érdekes, korát megelőző észrevétele (a 10. oldal lábjegyzetében), hogy az
        iterációnkénti új merevségi mátrix felépítése gyakran TÖBB gépidőt emészt fel,
        mint amennyit a több iterációval megspórolnánk — ezt a FEMAti mérhetővé és
        összehasonlíthatóvá tette a felületen.
      </p>,
      <p key="p5b">
        A konvergencia eldöntésére a dolgozat egy egyszerű, de robusztus mértéket
        használ: a reziduális (ki nem egyenlített) erők normájának és a külső terhek
        normájának hányadosát, százalékban kifejezve — ez a kritérium ma is
        standardnak számít nemlineáris végeselemes programokban. A dolgozat azt is
        világosan kimondja, hogy a teher-vezérelt eljárás a teherbírási határ
        közelében DEFINÍCIÓ SZERINT elakad (a merevség előjelet vált) — ez fizikai
        korlát, nem hiba, és a FEMAti ugyanezt a szemléletet követi: a nem-konvergencia
        a határteher közelében eredményként, nem szoftverhibaként jelenik meg a
        felületen.
      </p>,
      <p key="p6">
        Külön fejezet foglalkozik a tehermentesítéssel: mi történik, ha egy már
        képlékenyen alakváltozott keresztmetszetet tehermentesítünk — a rugalmas
        visszaalakulás után visszamaradó sajátfeszültségekkel, és azzal, hogy egy
        korábban elért terhelési szintre való ÚJRA-terhelés nem okoz újabb képlékeny
        alakváltozást (a „beállás" jelensége). Ez a rész a dolgozatot túlmutatja egy
        egyszerű teherbírás-vizsgálaton, és a valódi mérnöki gyakorlat felé (ismételt
        terhelés, fáradás-közeli állapotok) nyit ablakot.
      </p>,
      <p key="p6b">
        A dolgozat nem áll meg a tiszta mechanikánál: külön fejezetet szán a
        gyakorlati alkalmazáshoz szükséges anyag- és szelvényadatbázisnak is
        (rugalmassági modulus, folyáshatár, hőtágulási együttható, katalógus-
        keresztmetszetek), azzal az őszinte, a szerző saját szavaival is rögzített
        figyelmeztetéssel, hogy ezek az értékek TÁJÉKOZTATÓ jellegűek, és éles
        számításhoz ellenőrzésre szorulnak. Ezt az elvet a FEMAti szó szerint átvette:
        minden katalógusadat mellett kötelező forrás- és „ellenőrzött" jelölés
        szerepel — a program semmilyen adatot nem állít be hallgatólagosan
        megbízhatónak.
      </p>,
      <p key="p6c">
        1996-ban, a mai grafikus fejlesztőkörnyezetek és kész végeselemes könyvtárak
        nélkül, egy ilyen program megírása — a bemenetkezeléstől a numerikus
        megoldón át a kimenetig — önmagában is jelentős szoftvermérnöki teljesítmény
        volt, a mögötte álló mechanikai apparátus mellett. A dolgozat éppen ezért nem
        csak egy mérnöki számítási módszertant dokumentál, hanem egy TELJES, működő
        rendszert is: olyan tervezési döntésekkel (memóriakezelés, adatszerkezetek,
        az iterációnkénti újraszámolás költség-haszon mérlegelése), amelyek ma is
        érvényes szoftverfejlesztési szempontok.
      </p>,
      <p key="p7">
        Harminc évvel később a FEMAti ezt a numerikus apparátust rekonstruálja hitelesen,
        modern TypeScript-alapú szoftverként — minden egyes implementált képletet a
        dolgozat adott oldalszámához és egyenletéhez kötve, minden mechanikai
        állítást validációs teszttel (zárt alakú vagy kézzel számolt referenciával)
        bizonyítva. Ahol a mai szoftvermérnöki gyakorlat eltér az eredetitől (pl. a
        frontális megoldó helyett skyline-tárolás a produkciós útvonalon), azt egy
        külön döntési feljegyzés (ADR) rögzíti — de az eredeti gondolatmenet mindig
        elérhető és megmutatható marad.
      </p>,
    ],
  },
  timoshenko: {
    title: 'Timoshenko gerendaelem',
    subtitle: '3 csomópontos, kvadratikus, nyírási alakváltozást is figyelembe vevő rúdelem',
    body: [
      <p key="p1">
        A modell 3-csomópontos, kvadratikus <strong>Timoshenko-gerendaelem</strong>: a
        Bernoulli-gerendával szemben a keresztmetszet elfordulása (<em>φ</em>) és az
        alakváltozott középvonal iránytangense (<em>dw/dx</em>) NEM esik egybe — a
        különbség a nyírási torzulás (<em>γ</em>).
      </p>,
      <Formula key="f1" tex="\gamma = \varphi - \frac{dw}{dx} \qquad \kappa = \frac{d\varphi}{dx}" />,
      <p key="p2">
        <Ref>Diplomaterv (3.1), 33. oldal.</Ref> A keresztmetszeti igénybevételek a lineárisan
        rugalmas anyagtörvényből:
      </p>,
      <Formula key="f2" tex="M = EI \cdot \kappa \qquad T = GA_s \cdot \gamma" />,
      <p key="p3">
        Az elemi merevségi mátrix a virtuális munka elve szerint, a <em>B</em>{' '}
        alakváltozás-mátrixon keresztül:
      </p>,
      <Formula key="f3" tex="K_e = \int_{-1}^{1} B^{\mathsf T} D B \, |J| \, d\xi" />,
      <p key="p4">
        <Ref>Diplomaterv (3.11), 3.1.5, 38. oldal; mátrixos kifejtés (3.24)–(3.26), 3.1.7, 43. oldal.</Ref>{' '}
        A 3 csomópont kvadratikus alakfüggvényeket ad (<em>N₁,N₂,N₃</em>), ezért az elem
        6 szabadságfokú: <code>u = [w₁,φ₁,w₂,φ₂,w₃,φ₃]ᵀ</code> — a végpontokban ÉS a
        középpontban is önálló elmozdulás/elfordulás szabadságfok van.
      </p>,
      <p key="p5">
        Kód: <code>element/timoshenko3.ts</code> (<code>elementStiffness()</code>,{' '}
        <code>internalForces()</code>), <code>element/bMatrix.ts</code>. Teszt:{' '}
        <code>element.test.ts</code> — a tiszta nyírási/hajlítási energia zárt alakú
        ellenőrzése, és a merevtest-mozgás (<code>Kₑ·u_rigid = 0</code>) nulltér-vizsgálata.
      </p>,
    ],
  },
  integration: {
    title: 'Szelektív redukált integrálás',
    subtitle: 'A nyírási záródás (shear locking) elleni klasszikus védekezés',
    body: [
      <p key="p1">
        A Gauss–Legendre-kvadratúra a <code>[−1,1]</code> paramétertartományon közelíti
        az integrált:
      </p>,
      <Formula key="f1" tex="\int_{-1}^{1} f(\xi)\, d\xi \approx \sum_i a_i \cdot f(\xi_i)" />,
      <p key="p2">
        <Ref>Diplomaterv (3.16)–(3.17), 39. oldal; súlytáblázat, 40. oldal.</Ref>
      </p>,
      <p key="p3">
        Vékony (nagy karcsúságú) Timoshenko-gerendánál, ha a hajlítási ÉS a nyírási
        tagot is UGYANAZZAL a (teljes, 3 pontos) sémával integráljuk, az elem
        mesterségesen túl merevvé válik — ez a <strong>nyírási záródás</strong> (shear
        locking): a numerikusan konzisztens interpoláció nem tud nyírásmentes hajlítási
        állapotot pontosan reprodukálni, ezért parazita nyírási energia jelenik meg.
      </p>,
      <p key="p4">A megoldás — szelektív redukált integrálás:</p>,
      <ul key="l1" className="vem-theory__list">
        <li>
          <strong>Hajlítási tag:</strong> mindig <strong>3 pontos</strong> (teljes) séma.
        </li>
        <li>
          <strong>Nyírási tag:</strong> alapértelmezésben <strong>2 pontos</strong>{' '}
          (redukált) séma — ez szünteti meg a záródást.
        </li>
      </ul>,
      <p key="p5">
        A <code>full</code> séma (mindkét tag 3 pontos) is elérhető, kifejezetten
        didaktikai/összehasonlító célra — a felület "KT integrálási séma" kapcsolójával
        ez a jelenség közvetlenül bemutatható: a hiba <code>full</code> sémánál nő a
        karcsúsággal (<em>L/h</em>), <code>selective</code>-nél nem.
      </p>,
      <p key="p6">
        Kód: <code>element/quadrature.ts</code> (<code>quadratureFor()</code>). Teszt:{' '}
        <code>element.test.ts</code> — a V-04 locking-teszt éppen ezt a különbséget
        bizonyítja mérésekkel, nem csak állítja.
      </p>,
    ],
  },
  reforb: {
    title: 'Reziduális erők (REFORB)',
    subtitle: 'A nemlineáris (rugalmas–képlékeny) megoldó Newton–Raphson magja',
    body: [
      <p key="p1">
        A nemlineáris megoldás minden teherlépcsőben Newton–Raphson iterációval keresi
        az egyensúlyt — a diplomaterv 3.4.2.1/3.4.3.2 pontjának 7 lépéses algoritmusa,{' '}
        <Ref>65. oldal.</Ref>
      </p>,
      <Formula
        key="f1"
        tex="\psi_i = K_T \cdot \Delta u_i \qquad u \leftarrow u + \Delta u_i"
      />,
      <p key="p2">
        Minden iteráció után a belső erőket (<em>p = ∫Bᵀσ dx</em>, 3 pontos Gauss)
        újraszámoljuk a FRISSÍTETT anyagállapotból, és a reziduális erőt (a külső és a
        belső erő különbségét) vizsgáljuk — ez a REFORB
        (<strong>re</strong>siduál <strong>for</strong>ce <strong>b</strong>alance)
        elve:
      </p>,
      <Formula key="f2" tex="\psi^{(e)} = p^{(e)} - f^{(e)}" />,
      <p key="p3">
        A konvergenciát a CONUND-kritérium dönti el, SZÁZALÉKBAN kifejezve:
      </p>,
      <Formula
        key="f3"
        tex="100 \cdot \frac{\sqrt{\sum \psi_i^2}}{\sqrt{\sum f_i^2}} \leq \text{Tolerancia}"
      />,
      <p key="p4">
        <Ref>3.4.2.1/6, 65. oldal.</Ref> Minden Gauss-pont anyagállapota (folyás, feszültség,
        felhalmozott képlékeny alakváltozás) MINDEN Newton-iterációban frissül — nem csak
        lépésenként —, az ELŐZŐ ITERÁCIÓHOZ képesti görbület-növekményből
        (<em>Δκ</em>), zárt alakú (radial-return) feszültség-visszavetítéssel.
      </p>,
      <p key="p5">
        A határteher közelében a tangenciális merevségi mátrix szinguláris lehet — ez a
        teher-vezérelt eljárás definíció szerinti, FIZIKAI korlátja, nem szoftverhiba
        (ld. <a href="../docs/ADR/0013-teher-vezerelt-vs-ivhossz.md">ADR-0013</a>).
      </p>,
      <p key="p6">
        Kód: <code>solver/newtonRaphson.ts</code>, <code>solver/loadStepper.ts</code>,{' '}
        <code>solver/convergence.ts</code>, <code>solver/materialState.ts</code>. Teszt:{' '}
        <code>convergence.test.ts</code>, <code>materialState.test.ts</code>,{' '}
        <code>loadStepper.test.ts</code>.
      </p>,
    ],
  },
};

const CONTENT_EN: Record<TheoryTopic, TopicContent> = {
  thesis96: {
    title: 'Mathematical summary',
    subtitle: 'Full, self-consistent mathematical summary — from kinematics to the elastic–plastic nonlinear solver',
    body: [
      <p key="intro">
        This page summarizes the thesis's complete mechanical/numerical derivation as a
        single, self-building chain of reasoning — the shorter "Timoshenko beam
        element", "Selective reduced integration" and "Residual force balance (REFORB)"
        pages each go deeper into ONE part of it; this page gives the FULL chain, start
        to finish, with a consistent notation. Every formula is referenced against its
        source in <code>docs/THEORY.md</code> and the thesis's actual page number.
      </p>,

      <Section key="s1" num="1." title="Kinematic assumption and constitutive law" />,
      <p key="s1p1">
        The model is a straight-axis beam bent in-plane, whose cross-section stays
        PLANE during deformation but — unlike classical Bernoulli theory — does NOT
        stay perpendicular to the deformed centerline. The rotation of the
        cross-section (<em>φ</em>) and the slope of the centerline (<em>dw/dx</em>) are
        treated as INDEPENDENT degrees of freedom; their difference is the shear strain
        (<em>γ</em>), and the derivative of the cross-section's rotation with respect
        to x is the curvature (<em>κ</em>):
      </p>,
      <Formula key="s1f1" tex="\gamma(x) = \varphi(x) - \frac{dw}{dx} \qquad \kappa(x) = \frac{d\varphi}{dx}" />,
      <p key="s1p2">
        <Ref>Thesis (3.1), 3.1.1, p. 33.</Ref> The constitutive law couples bending and
        shear as TWO INDEPENDENT springs — the flexibility matrix (<em>H</em>) and the
        stiffness matrix (<em>D = H⁻¹</em>) are diagonal, because the model has no
        bending–shear coupling:
      </p>,
      <Formula key="s1f2" tex="\begin{Bmatrix}\kappa\\\gamma\end{Bmatrix} = H \begin{Bmatrix}M\\T\end{Bmatrix},\quad H = \mathrm{diag}\!\left(\frac{1}{EI},\ \frac{1}{GA_s}\right) \qquad D = H^{-1} = \mathrm{diag}(EI,\ GA_s)" />,
      <p key="s1p3">
        <Ref>(2.1)–(2.3), p. 15.</Ref> From this follow the cross-sectional stress
        resultants from the strains: <code>M = EI·κ</code> (bending moment),{' '}
        <code>T = GAs·γ</code> (shear force) — where <em>GAs</em> is the shear
        stiffness, corrected with the shear shape factor (see point 10).
      </p>,

      <Section key="s2" num="2." title="Isoparametric element and shape functions" />,
      <p key="s2p1">
        The element has 3 nodes (two end points + midpoint), local coordinate{' '}
        <code>ξ ∈ [−1, 1]</code>, with nodes at <code>ξ = −1, 0, +1</code>. The
        quadratic Lagrange shape functions:
      </p>,
      <Formula
        key="s2f1"
        tex="N_1(\xi) = \tfrac12\xi(\xi-1) \qquad N_2(\xi) = 1-\xi^2 \qquad N_3(\xi) = \tfrac12\xi(\xi+1)"
      />,
      <p key="s2p2">
        <Ref>(3.4)–(3.6), 3.1.4, p. 37.</Ref> The shape functions play a DUAL role
        (isoparametric formulation): they describe both the geometry (the real{' '}
        <em>x</em> coordinate) AND the interpolation of the displacement field from the
        nodal values:
      </p>,
      <Formula key="s2f2" tex="x(\xi) = \sum_{i=1}^{3} N_i(\xi)\cdot x_i" />,
      <p key="s2p3">
        <Ref>(3.10), p. 38.</Ref> The mapping between the local and the real coordinate
        is given by the Jacobian determinant; the element is well-defined (not
        "twisted") only where this is positive everywhere:
      </p>,
      <Formula
        key="s2f3"
        tex="J = \frac{dx}{d\xi} = \sum_{i=1}^{3} \frac{dN_i}{d\xi}\cdot x_i \,,\qquad \det J \neq 0"
      />,
      <p key="s2p4">
        <Ref>(3.7)–(3.9), p. 37.</Ref> The chain rule gives the shape functions' REAL
        (with respect to x) derivative, which is needed for the B matrix (point 3):
      </p>,
      <Formula key="s2f4" tex="\frac{dN_i}{dx} = \frac{dN_i}{d\xi}\cdot J^{-1}" />,
      <p key="s2p5"><Ref>(3.12)–(3.13), p. 38.</Ref></p>,

      <Section key="s3" num="3." title="B matrix — strain interpolation" />,
      <p key="s3p1">
        The nodal displacement vector <code>uₑ = [w₁,φ₁,w₂,φ₂,w₃,φ₃]ᵀ</code> (6 degrees
        of freedom — one deflection AND one rotation at each of the three nodes). The
        γ/κ strains are obtained from the displacements by differentiating point 1's
        kinematics (3.1) with respect to x, substituting the shape functions — this is
        the B matrix:
      </p>,
      <Formula
        key="s3f1"
        tex="B(\xi) = \begin{bmatrix} 0 & \tfrac{dN_1}{dx} & 0 & \tfrac{dN_2}{dx} & 0 & \tfrac{dN_3}{dx} \\[4pt] -\tfrac{dN_1}{dx} & N_1 & -\tfrac{dN_2}{dx} & N_2 & -\tfrac{dN_3}{dx} & N_3 \end{bmatrix}"
      />,
      <p key="s3p2">
        <Ref>(3.14)–(3.15), p. 39.</Ref> The top row produces the curvature (κ), the
        bottom row the shear strain (γ), from the nodal displacements:{' '}
        <code>ε = B·uₑ</code>, where <code>ε = [κ, γ]ᵀ</code>.{' '}
        <Ref>(3.30), p. 45.</Ref>
      </p>,

      <Section key="s4" num="4." title="Numerical integration and shear locking" />,
      <p key="s4p1">
        The integrals of the element matrices (point 5) are approximated on the{' '}
        <code>[−1,1]</code> domain with Gauss–Legendre quadrature:
      </p>,
      <Formula key="s4f1" tex="\int_{-1}^{1} f(\xi)\, d\xi \approx \sum_i a_i \cdot f(\xi_i)" />,
      <p key="s4p2">
        <Ref>(3.16)–(3.17), p. 39; weight table, p. 40.</Ref> If the bending AND the
        shear term are both integrated with the SAME (full, 3-point) scheme, for a
        thin (highly slender) beam the element becomes artificially too stiff —{' '}
        <strong>shear locking</strong>: the quadratic interpolation cannot exactly
        reproduce a shear-free bending state, so parasitic shear energy appears. The
        thesis applies <strong>selective reduced integration</strong> against this: the
        bending term is always integrated with the 3-point (full) scheme, the shear
        term by default with the 2-point (reduced) scheme — this removes the locking.{' '}
        <Ref>3.1.4, narrative justification.</Ref>
      </p>,

      <Section key="s5" num="5." title="Element stiffness matrix" />,
      <p key="s5p1">By the principle of virtual work, the element stiffness matrix is:</p>,
      <Formula key="s5f1" tex="K_e = \int_{-1}^{1} B^{\mathsf T} D B \, |J| \, d\xi" />,
      <p key="s5p2">
        <Ref>(3.11), 3.1.5, p. 38; matrix form (3.24)–(3.26), 3.1.7, p. 43.</Ref> Since
        the bending and shear terms are integrated with SEPARATE quadrature schemes
        (point 4), the code assembles them in two separate loops — the result is the
        same 6×6, symmetric <code>Kₑ</code> matrix, whose null space is exactly the
        rigid-body motions (pure translation <code>w=1,φ=0</code> and rigid rotation{' '}
        <code>w=x,φ=1</code>) — <code>Kₑ·u_rigid = 0</code>.
      </p>,

      <Section key="s6" num="6." title="Global system of equations and boundary conditions" />,
      <p key="s6p1">
        Assembling the element matrices by nodal degree of freedom (global index{' '}
        <code>2i, 2i+1</code> for every node) gives the structural system of equations:
      </p>,
      <Formula key="s6f1" tex="K \cdot v = q" />,
      <p key="s6p2">
        <Ref>(3.27), p. 43.</Ref> <code>K</code> is symmetric and — without supports —
        singular (the degree of singularity matches the structure's mechanism count).
        Boundary conditions (supports) can be enforced two ways: degree-of-freedom
        elimination, or adding a large (~10¹⁰ kN/m) spring constant to the diagonal
        (<em>penalty</em> method). <Ref>3.1.7.1/3.1.7.3, pp. 43–44.</Ref> The Winkler
        elastic foundation (if present) is added to the stiffness matrix as a separate
        term, built from the shape functions:
      </p>,
      <Formula key="s6f2" tex="K_{\text{bed}} = \int N^{\mathsf T} \cdot c \cdot N \, dx" />,
      <p key="s6p3"><Ref>(3.28), 3.1.7.2, p. 44.</Ref></p>,

      <Section key="s7" num="7." title="Load vectors" />,
      <p key="s7p1">
        The element load vector is made up of three sources: initial strain (thermal
        load), body/surface forces, and — handled separately — concentrated nodal
        loads:
      </p>,
      <Formula
        key="s7f1"
        tex="q_e = \int B^{\mathsf T} D \varepsilon_0\, dV \;+\; \int N^{\mathsf T} p\, dV \;+\; \int N^{\mathsf T} p\, dS"
      />,
      <p key="s7p2">
        <Ref>(3.19)–(3.21), 3.1.6, p. 40.</Ref> For a concentrated load the integral
        reduces to a simple sum (<code>qₑᵢ = Σ Nᵢᵀ·pᵢ</code>,{' '}
        <Ref>(3.22), p. 41</Ref>), a distributed load integrates for a
        linear/parabolic <code>q(x)</code> (<Ref>3.1.6.2, p. 41</Ref>), self-weight
        comes from the density load <code>p_z = γ·A</code> (<Ref>(3.23), p. 42</Ref>),
        and a thermal load appears as an initial curvature (<em>κ0</em>) in the strain:
      </p>,
      <Formula key="s7f2" tex="\kappa_0 = \frac{\alpha\cdot(t_{\text{bottom}} - t_{\text{top}})}{h} \,,\qquad \varepsilon_0 = [\kappa_0,\ 0]^{\mathsf T}" />,
      <p key="s7p3"><Ref>3.1.6.4, p. 42.</Ref></p>,

      <Section key="s8" num="8." title="Linear solution and post-processing" />,
      <p key="s8p1">
        Solving the <code>K·v = q</code> system (in the thesis by Gaussian elimination
        with a frontal algorithm — point 18; in today's code with skyline-LDLᵀ) gives
        the displacements. The back-substituted stress resultant — together with the
        thermal load — is <code>M = EI·(κ − κ0)</code>.{' '}
        <Ref>3.1.7.4/1.6, p. 45.</Ref> Since stresses (at the Gauss points) must be
        written out at the nodes, the thesis prescribes a second-order Lagrange
        extrapolation (the 3 Gauss points AND the 3 nodes are both 3 locations, so this
        is a closed-form, rotation-free linear map); at an element boundary, the
        extrapolated values of the two neighboring elements are simply averaged.{' '}
        <Ref>3.1.7.4, p. 46.</Ref>
      </p>,

      <Section key="s9" num="9." title="Cross-section properties and the shape factor" />,
      <p key="s9p1">
        The elastic and the plastic section modulus (the latter twice the first moment
        of area about the centroidal axis) give the shape factor — the ratio between
        the fully plastic and the elastic limit moment:
      </p>,
      <Formula
        key="s9f1"
        tex="K_e = \frac{I}{y_{max}} \qquad K_p = 2\cdot S_0 \qquad c = \frac{K_p}{K_e}"
      />,
      <p key="s9p2">
        <Ref>(3.37), (3.39), Table 4, pp. 53–54.</Ref> Per the thesis's Table 4,{' '}
        <code>c</code> is 1.50 for a rectangle, 1.70 for a circle, 1.27 for a circular
        ring (in the thin-walled limit), 1.14–1.16 for a stocky-web I-section — today's
        code reproduces these in closed form (see the validation section on the "About
        the thesis" page).
      </p>,

      <Section key="s10" num="10." title="Elastic–plastic material model — section-force level" />,
      <p key="s10p1">
        The thesis introduces two complementary plasticity models. The simpler,{' '}
        <strong>section-force-level</strong> model treats the whole cross-section as a
        SINGLE M–κ spring, with a closed-form yield condition. The fully plastic moment
        capacity:
      </p>,
      <Formula key="s10f1" tex="M_0 = \sigma_0 \cdot K_p" />,
      <p key="s10p2">
        <Ref>(3.47), 3.4.2, p. 62.</Ref> Strain splits into an elastic and a plastic
        part (<code>dε = dε_e + dε_p</code>, <Ref>(3.48), p. 62</Ref>); the hardening
        modulus is the moment–strain slope measured on the yield surface, during
        loading (<code>H' = (dM/dε)</code>, at loading, at <code>f=0</code>,{' '}
        <Ref>(3.49), p. 62</Ref>). From this follows the tangent bending stiffness:
      </p>,
      <Formula key="s10f2" tex="EI_T = \frac{EI\cdot H'}{EI + H'}" />,
      <p key="s10p3">
        <Ref>(3.50)–(3.51), p. 63.</Ref> Shear ALWAYS stays elastic in this model (
        <code>dQ = GAs·dγ</code>, <Ref>(3.52), p. 63</Ref>) — the yield condition
        applies only to the bending moment (<code>f = M² − M0²</code>).
      </p>,

      <Section key="s11" num="11." title="Layered (fiber) cross-section — the main model" />,
      <p key="s11p1">
        The thesis's MAIN, considerably more refined model splits the cross-section
        into thin layers (fibers), and assigns each layer its OWN uniaxial
        elastic–plastic constitutive law — this is what makes it possible to track the
        gradual spread of the plastic zone WITHIN the cross-section. The layered
        stiffnesses:
      </p>,
      <Formula
        key="s11f1"
        tex="EI = \sum_l E_l \cdot b_l \cdot z_l^2 \cdot t_l \qquad GA = \sum_l G_l \cdot b_l \cdot t_l"
      />,
      <p key="s11p2">
        <Ref>(3.53)–(3.54), 3.4.3, p. 64.</Ref> The cross-sectional stress resultant
        from the per-layer stresses:
      </p>,
      <Formula key="s11f2" tex="M = \sum_l \sigma_{xl}\cdot b_l\cdot z_l\cdot t_l \qquad Q = \sum_l \tau_{xzl}\cdot b_l\cdot t_l" />,
      <p key="s11p3">
        <Ref>(3.59), 3.4.3.2, p. 65.</Ref> The per-layer stress return-mapping — called
        REFORB in the thesis — decides, layer by layer, per a four-case decision table,
        whether a step stayed elastic, just crossed the yield limit, or continues in
        already-yielded material. The post-yield fraction (<em>R</em>, the{' '}
        <code>AB/AC</code> ratio between the trial and the actual stress increment)
        scales the plastic step:
      </p>,
      <Formula
        key="s11f3"
        tex="\Delta\sigma_{ep} = R\cdot\Delta\sigma_r\cdot\frac{E}{E+H'} \qquad \Delta\varepsilon_p = R\cdot\Delta\varepsilon_r\cdot\frac{E}{E+H'}"
      />,
      <p key="s11p4">
        <Ref>3.4.4, Fig. 3-10, pp. 66–68.</Ref> The balanced nodal force (recovered from
        the layered stresses) via 3-point Gauss integration:
      </p>,
      <Formula key="s11f4" tex="f = \int B^{\mathsf T}\sigma_r \, dx" />,
      <p key="s11p5"><Ref>(3.60), p. 68.</Ref></p>,

      <Section key="s12" num="12." title="Nonlinear solver — incremental-iterative Newton–Raphson" />,
      <p key="s12p1">
        The thesis solves the nonlinear system (for both the section-force-level and
        the layered model) with an incremental-iterative Newton–Raphson procedure,
        load step by load step — a 7-step algorithm: take a load increment, build the
        tangent stiffness matrix (<em>K_T</em>), solve the system of equations (
        <em>Δu</em>), update the displacement, recompute the internal force from the
        UPDATED material state, compute the residual, check convergence.
      </p>,
      <Formula key="s12f1" tex="\psi_i = K_T \cdot \Delta u_i \qquad u \leftarrow u + \Delta u_i" />,
      <p key="s12p2">
        <Ref>3.4.2.1/3.4.3.2, p. 65.</Ref> The residual (unbalanced) force is the
        difference between the internal force recomputed from the UPDATED material
        state (3-point Gauss) and the external load:
      </p>,
      <Formula key="s12f2" tex="\psi^{(e)} = p^{(e)} - f^{(e)} \,,\qquad p^{(e)} = \int B^{\mathsf T}\sigma\, dx" />,
      <p key="s12p3">
        Convergence is decided by the CONUND criterion — the ratio of the norm of the
        residual forces to the norm of the external loads, as a percentage:
      </p>,
      <Formula key="s12f3" tex="100 \cdot \frac{\sqrt{\sum \psi_i^2}}{\sqrt{\sum f_i^2}} \leq \text{Tolerance}" />,
      <p key="s12p4">
        <Ref>3.4.2.1/6, p. 65.</Ref> The thesis also states clearly that the
        load-controlled procedure, by definition, stalls near the load-carrying limit
        (the tangent stiffness changes sign, becomes singular) — this is a physical
        limit, not a bug. On unloading, every layer returns along the elastic{' '}
        <em>E</em> slope (not the plastic <em>EI_T</em>) — this produces the residual
        (self-equilibrated) stresses, and the fact that RE-loading to a previously
        reached load level causes no further plastic deformation (the phenomenon of
        "shakedown").
      </p>,

      <Section key="s13" num="13." title="Closing" />,
      <p key="s13p1">
        These 13 points give the thesis's complete numerical backbone: from the
        kinematics (point 1) to the layered, nonlinear solver (points 11–12) — every
        step is PRECISELY identifiable in today's code as a tested function, and every
        one has at least one validation case (a closed-form or hand-calculated
        reference). The more detailed derivation, the module diagram (the thesis's
        original FORTRAN-like module names — <code>SFR1</code>, <code>JACOBI</code>,{' '}
        <code>MODB</code>, <code>STIFFB</code>, <code>FRONT</code>, <code>NONAL</code>,{' '}
        <code>REFORB</code>, <code>CONUND</code> etc. — and today's counterparts), the
        list of mutation tests, and the full validation report are available in the{' '}
        <code>docs/THEORY.md</code> and <code>docs/VALIDATION.md</code> files.
      </p>,
      <p key="s13p2">
        The shorter sub-pages — "Timoshenko beam element" (points 2–3 in more depth),
        "Selective reduced integration" (point 4 in more depth), and "Residual force
        balance (REFORB)" (points 11–12 in more depth) — discuss the same material
        individually, in more detail.
      </p>,
    ],
  },
  about: {
    title: 'About the thesis',
    subtitle: 'Attila Bánya: Numerical Investigation of Elastic–Plastic Beam Structures Using the Finite Element Method (BME, 1996)',
    body: [
      <p key="p1">
        FEM@ti is built on the 1996 thesis of Attila Bánya, structural engineer,
        written at the Department of Mechanics, Faculty of Civil Engineering, Budapest
        University of Technology (BME), under the supervision of Dr. Imre Bojtár. The
        thesis's title: "Numerical Investigation of Elastic–Plastic Beam Structures
        Using the Finite Element Method" — the goal was not to use an existing
        commercial program, but to write a COMPLETE, self-developed finite element
        program from scratch: from building the model, through solving the system of
        equations, to tracking plastic deformation.
      </p>,
      <p key="p2">
        The mechanical core is a three-node, isoparametric, quadratic Timoshenko beam
        element — unlike classical Bernoulli theory, this also accounts for shear
        deformation, which makes a meaningful accuracy difference for stockier (less
        slender) beams. The thesis devotes a separate chapter to the phenomenon of
        "locking" (shear locking) and the selective reduced integration used against
        it — at the time this was far from an obvious design choice; the author had to
        explicitly recognize and address the numerical problem.
      </p>,
      <p key="p3">
        For solving the system of equations, the thesis uses a{' '}
        <strong>frontal solver</strong>, justified by the computing constraints of the
        era (scarce memory): the stiffness matrix is never assembled in full —
        proceeding element by element, degrees of freedom that are already "closed"
        are continuously eliminated, so memory demand is set by the current width of
        the front, not by the size of the whole structure. FEM@ti also preserves this
        original algorithm, as "Historical mode", with an animated walkthrough.
      </p>,
      <p key="p4">
        The thesis's most significant engineering contribution is its two
        complementary implementations of the elastic–plastic material model. The
        simpler, section-force-level model describes the state of the whole
        cross-section with a single moment–curvature relationship and a closed-form
        yield condition — fast, but it only knows whether the cross-section AS A WHOLE
        has yielded. The thesis's main model is considerably more refined: it splits
        the cross-section into thin layers (fibers) and assigns each layer its OWN
        uniaxial elastic–plastic constitutive law, including hardening. This makes it
        possible to track the gradual spread of the plastic zone WITHIN the
        cross-section — not just whether it has yielded, but HOW MUCH.
      </p>,
      <p key="p5">
        The nonlinear system is solved with an incremental-iterative Newton–Raphson
        procedure, load step by load step. In every iteration, trial stresses are
        returned to the yield surface with an R-factor return-mapping scheme (referred
        to in the thesis as "REFORB") — this decides, layer by layer, whether a given
        step remained elastic, just crossed the yield limit, or continues in
        already-yielded material. An interesting, ahead-of-its-time observation in the
        thesis (in a footnote on page 10) is that rebuilding the stiffness matrix every
        iteration often costs MORE machine time than the iterations it saves — FEM@ti
        makes this measurable and comparable in the app.
      </p>,
      <p key="p5b">
        For deciding convergence, the thesis uses a simple but robust measure: the
        ratio of the norm of the residual (unbalanced) forces to the norm of the
        external loads, expressed as a percentage — this criterion is still standard
        in nonlinear finite element programs today. The thesis also states clearly
        that the load-controlled procedure, by definition, stalls near the
        load-carrying limit (the tangent stiffness changes sign) — this is a physical
        limit, not a bug, and FEM@ti follows the same view: non-convergence near the
        ultimate load appears in the app as a RESULT, not a software error.
      </p>,
      <p key="p6">
        A separate chapter deals with unloading: what happens when an already
        plastically deformed cross-section is unloaded — the residual
        (self-equilibrated) stresses left behind after elastic recovery, and the fact
        that RE-loading to a previously reached load level causes no further plastic
        deformation (the phenomenon of "shakedown"). This section takes the thesis
        beyond a simple capacity check, opening a window toward real engineering
        practice (repeated loading, near-fatigue states).
      </p>,
      <p key="p6b">
        The thesis does not stop at pure mechanics: it also devotes a separate chapter
        to the material and cross-section database needed for practical application
        (modulus of elasticity, yield strength, thermal expansion coefficient, catalog
        cross-sections), with the honest warning — in the author's own words — that
        these values are for GUIDANCE only and need verification for real
        calculations. FEM@ti has taken this principle literally: every catalog record
        carries a mandatory source and "verified" flag — the program never silently
        treats any data as reliable.
      </p>,
      <p key="p6c">
        In 1996, without today's graphical development environments and ready-made
        finite element libraries, writing such a program — from input handling through
        the numerical solver to output — was in itself a significant
        software-engineering achievement, alongside the mechanical apparatus behind
        it. The thesis therefore documents not just an engineering calculation method,
        but a COMPLETE, working system — with design decisions (memory management,
        data structures, weighing the cost/benefit of rebuilding the stiffness matrix
        every iteration) that remain valid software-engineering considerations today.
      </p>,
      <p key="p7">
        Thirty years later, FEM@ti faithfully reconstructs this numerical apparatus as
        a modern, TypeScript-based piece of software — every implemented formula tied
        to the thesis's exact page and equation number, every mechanical claim proven
        with a validation test (against a closed-form or hand-calculated reference).
        Wherever current software-engineering practice diverges from the original
        (e.g. skyline storage instead of the frontal solver on the production path),
        that is recorded in a separate architecture decision record (ADR) — but the
        original line of reasoning always remains available and demonstrable.
      </p>,
    ],
  },
  timoshenko: {
    title: 'Timoshenko beam element',
    subtitle: '3-node quadratic beam element that also accounts for shear deformation',
    body: [
      <p key="p1">
        The model is a 3-node, quadratic <strong>Timoshenko beam element</strong>:
        unlike the Bernoulli beam, the rotation of the cross-section (<em>φ</em>) and
        the slope of the deformed centerline (<em>dw/dx</em>) do NOT coincide — their
        difference is the shear strain (<em>γ</em>).
      </p>,
      <Formula key="f1" tex="\gamma = \varphi - \frac{dw}{dx} \qquad \kappa = \frac{d\varphi}{dx}" />,
      <p key="p2">
        <Ref>Thesis (3.1), p. 33.</Ref> The cross-sectional stress resultants follow
        from the linearly elastic constitutive law:
      </p>,
      <Formula key="f2" tex="M = EI \cdot \kappa \qquad T = GA_s \cdot \gamma" />,
      <p key="p3">
        The element stiffness matrix follows from the principle of virtual work,
        through the <em>B</em> strain matrix:
      </p>,
      <Formula key="f3" tex="K_e = \int_{-1}^{1} B^{\mathsf T} D B \, |J| \, d\xi" />,
      <p key="p4">
        <Ref>Thesis (3.11), 3.1.5, p. 38; matrix form (3.24)–(3.26), 3.1.7, p. 43.</Ref>{' '}
        The 3 nodes give quadratic shape functions (<em>N₁,N₂,N₃</em>), so the element
        has 6 degrees of freedom: <code>u = [w₁,φ₁,w₂,φ₂,w₃,φ₃]ᵀ</code> — there is an
        independent displacement/rotation degree of freedom at the end points AND at
        the midpoint.
      </p>,
      <p key="p5">
        Code: <code>element/timoshenko3.ts</code> (<code>elementStiffness()</code>,{' '}
        <code>internalForces()</code>), <code>element/bMatrix.ts</code>. Test:{' '}
        <code>element.test.ts</code> — closed-form verification of pure shear/bending
        energy, and a null-space check of the rigid-body motion (
        <code>Kₑ·u_rigid = 0</code>).
      </p>,
    ],
  },
  integration: {
    title: 'Selective reduced integration',
    subtitle: 'The classic defense against shear locking',
    body: [
      <p key="p1">
        Gauss–Legendre quadrature approximates the integral over the{' '}
        <code>[−1,1]</code> parameter domain:
      </p>,
      <Formula key="f1" tex="\int_{-1}^{1} f(\xi)\, d\xi \approx \sum_i a_i \cdot f(\xi_i)" />,
      <p key="p2">
        <Ref>Thesis (3.16)–(3.17), p. 39; weight table, p. 40.</Ref>
      </p>,
      <p key="p3">
        For a thin (highly slender) Timoshenko beam, if the bending AND the shear term
        are both integrated with the SAME (full, 3-point) scheme, the element becomes
        artificially too stiff — this is <strong>shear locking</strong>: the
        numerically consistent interpolation cannot exactly reproduce a shear-free
        bending state, so parasitic shear energy appears.
      </p>,
      <p key="p4">The fix — selective reduced integration:</p>,
      <ul key="l1" className="vem-theory__list">
        <li>
          <strong>Bending term:</strong> always the <strong>3-point</strong> (full)
          scheme.
        </li>
        <li>
          <strong>Shear term:</strong> by default the <strong>2-point</strong>{' '}
          (reduced) scheme — this removes the locking.
        </li>
      </ul>,
      <p key="p5">
        The <code>full</code> scheme (both terms 3-point) is also available,
        specifically for teaching/comparison purposes — the app's "quadrature scheme"
        toggle demonstrates this directly: with the <code>full</code> scheme the error
        grows with slenderness (<em>L/h</em>), with <code>selective</code> it does not.
      </p>,
      <p key="p6">
        Code: <code>element/quadrature.ts</code> (<code>quadratureFor()</code>). Test:{' '}
        <code>element.test.ts</code> — the V-04 locking test proves exactly this
        difference by measurement, not just by assertion.
      </p>,
    ],
  },
  reforb: {
    title: 'Residual force balance (REFORB)',
    subtitle: 'The Newton–Raphson core of the nonlinear (elastic–plastic) solver',
    body: [
      <p key="p1">
        The nonlinear solution seeks equilibrium in every load step with
        Newton–Raphson iteration — the 7-step algorithm of thesis section
        3.4.2.1/3.4.3.2, <Ref>p. 65.</Ref>
      </p>,
      <Formula
        key="f1"
        tex="\psi_i = K_T \cdot \Delta u_i \qquad u \leftarrow u + \Delta u_i"
      />,
      <p key="p2">
        After every iteration, the internal forces (<em>p = ∫Bᵀσ dx</em>, 3-point
        Gauss) are recomputed from the UPDATED material state, and the residual force
        (the difference between the external and the internal force) is examined —
        this is the principle of REFORB (
        <strong>re</strong>sidual <strong>for</strong>ce <strong>b</strong>alance):
      </p>,
      <Formula key="f2" tex="\psi^{(e)} = p^{(e)} - f^{(e)}" />,
      <p key="p3">
        Convergence is decided by the CONUND criterion, expressed as a PERCENTAGE:
      </p>,
      <Formula
        key="f3"
        tex="100 \cdot \frac{\sqrt{\sum \psi_i^2}}{\sqrt{\sum f_i^2}} \leq \text{Tolerance}"
      />,
      <p key="p4">
        <Ref>3.4.2.1/6, p. 65.</Ref> Every Gauss point's material state (yielding,
        stress, accumulated plastic strain) is updated in EVERY Newton iteration — not
        just once per step — from the curvature increment RELATIVE TO THE PREVIOUS
        ITERATION (<em>Δκ</em>), with a closed-form (radial-return) stress
        return-mapping.
      </p>,
      <p key="p5">
        Near the ultimate load, the tangent stiffness matrix can become singular — this
        is the load-controlled procedure's PHYSICAL limit by definition, not a
        software bug (see{' '}
        <a href="../docs/ADR/0013-teher-vezerelt-vs-ivhossz.md">ADR-0013</a>).
      </p>,
      <p key="p6">
        Code: <code>solver/newtonRaphson.ts</code>, <code>solver/loadStepper.ts</code>,{' '}
        <code>solver/convergence.ts</code>, <code>solver/materialState.ts</code>. Test:{' '}
        <code>convergence.test.ts</code>, <code>materialState.test.ts</code>,{' '}
        <code>loadStepper.test.ts</code>.
      </p>,
    ],
  },
};

const CONTENT: Record<Lang, Record<TheoryTopic, TopicContent>> = { hu: CONTENT_HU, en: CONTENT_EN };

export function TheoryView(): JSX.Element | null {
  const theoryOpen = useAppStore((s) => s.theoryOpen);
  const theoryTopic = useAppStore((s) => s.theoryTopic);
  const setTheoryOpen = useAppStore((s) => s.setTheoryOpen);
  const openTheory = useAppStore((s) => s.openTheory);
  const lang = useAppStore((s) => s.lang);

  if (!theoryOpen) return null;

  const close = (): void => setTheoryOpen(false);
  const content = CONTENT[lang][theoryTopic];
  const strings = STRINGS[lang];

  return (
    <div className="vem-overlay vem-theory-overlay" onPointerDown={close}>
      <div className="vem-theory" onPointerDown={(e) => e.stopPropagation()}>
        <nav className="vem-theory__nav" aria-label={strings.navAria}>
          <div className="vem-theory__nav-head">
            <h1>{strings.nav}</h1>
          </div>
          {TOPICS.map((id) => (
            <button
              key={id}
              type="button"
              className="vem-theory__nav-item"
              aria-current={theoryTopic === id}
              onClick={() => openTheory(id)}
            >
              {CONTENT[lang][id].title}
            </button>
          ))}
          <p className="vem-theory__nav-note">{strings.navNote}</p>
        </nav>
        <article className="vem-theory__content">
          <header className="vem-theory__header">
            <div className="vem-theory__header-title">
              {theoryTopic === 'about' && <Logo variant="full" theme="dark" size={92} />}
              <div>
                <h2>{content.title}</h2>
                <p className="vem-theory__subtitle">{content.subtitle}</p>
              </div>
            </div>
            <button type="button" className="vem-btn vem-btn--sm" onClick={close}>
              {strings.close}
            </button>
          </header>
          <div className="vem-theory__body">{content.body}</div>
        </article>
      </div>
    </div>
  );
}
