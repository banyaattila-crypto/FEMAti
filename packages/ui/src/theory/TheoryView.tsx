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
 */
import './theory.css';
import { Formula } from '../derivation/Formula.js';
import { Logo } from '../components/Logo.js';
import { useAppStore, type TheoryTopic } from '../state/appStore.js';

interface TopicContent {
  readonly title: string;
  readonly subtitle: string;
  readonly body: readonly JSX.Element[];
}

const TOPICS: readonly { id: TheoryTopic; label: string }[] = [
  { id: 'thesis96', label: "Diplomaterv '96" },
  { id: 'about', label: 'A diplomatervről' },
  { id: 'timoshenko', label: 'Timoshenko gerendaelem' },
  { id: 'integration', label: 'Szelektív redukált integrálás' },
  { id: 'reforb', label: 'Reziduális erők (REFORB)' },
];

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

const CONTENT: Record<TheoryTopic, TopicContent> = {
  thesis96: {
    title: "Diplomaterv '96",
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

export function TheoryView(): JSX.Element | null {
  const theoryOpen = useAppStore((s) => s.theoryOpen);
  const theoryTopic = useAppStore((s) => s.theoryTopic);
  const setTheoryOpen = useAppStore((s) => s.setTheoryOpen);
  const openTheory = useAppStore((s) => s.openTheory);

  if (!theoryOpen) return null;

  const close = (): void => setTheoryOpen(false);
  const content = CONTENT[theoryTopic];

  return (
    <div className="vem-theory-overlay" onPointerDown={close}>
      <div className="vem-theory" onPointerDown={(e) => e.stopPropagation()}>
        <nav className="vem-theory__nav" aria-label="Elmélet témák">
          <h1>Elmélet</h1>
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="vem-theory__nav-item"
              aria-current={theoryTopic === t.id}
              onClick={() => openTheory(t.id)}
            >
              {t.label}
            </button>
          ))}
          <p className="vem-theory__nav-note">
            Teljes forrás: <code>docs/THEORY.md</code>
          </p>
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
              Bezárás
            </button>
          </header>
          <div className="vem-theory__body">{content.body}</div>
        </article>
      </div>
    </div>
  );
}
