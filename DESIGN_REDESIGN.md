# SideEffectHer — projekt całkowitego redesignu

Status: plan i klikalna makieta. Makieta jest osobnym widokiem koncepcyjnym z fikcyjnymi danymi; nie zapisuje do bazy. Istniejące ekrany i integracje pozostają działające.

Podgląd: http://localhost:3000/design/redesign-preview.html

## Iteracja 2 — grafika przestrzenna i dopracowany ruch

Makieta ma teraz śliwkową kartę leku z grafiką na przezroczystym tle, łukami w tle i delikatnym światłem. Zamiast systemowego serif używa lokalnie pobranych Cormorant Garamond oraz Manrope. Licencje SIL OFL są zapisane obok fontów w `public/design/fonts`.

- Nowa grafika imagegen: `public/design/assets/medication-sculpture.png`; ozdobny obiekt nie reprezentuje konkretnego preparatu.
- Efekty: wejście grafiki 1100 ms; pojawianie się sekcji przy przewijaniu 750 ms z krótkim stopniowaniem; przejście ekranów 180–500 ms; panel 400–500 ms; reakcja przycisku na dotyk 600 ms.
- Grafika reaguje na kursor wyłącznie na urządzeniach z precyzyjnym wskaźnikiem. Tekst pozostaje nieruchomy. Brak śledzenia ruchu telefonu i brak bezustannych animacji.
- Aktywne tło nawigacji płynnie przesuwa się między zakładkami. Rozmiar i położenie są ponownie wyliczane po zmianie szerokości i załadowaniu fontów.
- Szybkie zmiany zakładki przerywają poprzednie przejście; jego warstwa graficzna nie przechwytuje kliknięć. Najnowszy wybór ma pierwszeństwo.
- Wszystkie efekty respektują `prefers-reduced-motion`. W przeglądarce bez View Transitions zakładki przełączają się bez tego efektu.
- Kod efektów: `public/design/premium.css` i `public/design/premium.js`.

Sprawdzono widok desktopowy, 320 i 390 px, załadowanie lokalnych fontów i grafiki, przełączanie zakładek, panel objawu i podgląd potwierdzenia. Przy 390 px szerokość treści mieści się w ekranie, a główna akcja znajduje się powyżej dolnej nawigacji. Konsola bez błędów aplikacji; składnia obu skryptów poprawna. Zrzuty: `public/design/redesign-mobile-v2.jpg` oraz `public/design/redesign-desktop-v2.jpg`. Nie wykonywano emulacji ustawienia ograniczonego ruchu; obsługa została zaimplementowana w CSS i JS.

Prompt nowej grafiki, wbudowane imagegen, `transparent_background: true`:

> A single exquisite sculptural still life cutout for a luxury women's medication journaling app. Transparent background, isolated objects, no floor and no backdrop. A large smooth warm ivory ceramic capsule oriented diagonally floating inside one broad elegant loop of deep burgundy plum satin ribbon. A small translucent lavender glass oval placed near the lower left capsule tip, with a hint of muted brushed rose metal at the ribbon edge. Tactile material realism, high end editorial CGI, balanced soft directional studio light, soft realistic object self-shadows, delicate highlights, satin fabric visible weave. Strong legible silhouette, airy asymmetrical composition, all objects in frame with generous transparent padding, objects occupy most of square composition. Understated feminine sophistication like a luxury magazine art director, beautifully controlled folds, sculptural flowing arc. No text, no logos, no drug brand, no package, no dosage, no medical symbols, no sparkles, no flowers, no heart, no people, no background gradients. Decorative symbolic medicine art, not a specific drug. The cutout must look beautiful on a deep dark plum app hero background.

Poniższy pierwotny plan nadal opisuje kolejność właściwego wdrożenia; iteracja 2 zastępuje w makiecie bazową typografię, kartę leku i warstwę animacji.

Sprawdzenie makiety: widok desktopowy oraz 390 × 844 i 320 × 740; na 320 px brak poziomego przepełnienia, przycisk głównej akcji mieści się nad dolną nawigacją. Sprawdzono przejścia między czterema ekranami, ręczny wpis objawu → podgląd → edycja z zachowaniem danych → potwierdzenie → historia. Składnia JavaScript makiety poprawna. Zrzut mobilny: `public/design/redesign-mobile.jpg`. Kontrast, fonty docelowe i pełny zapis do bazy są punktami weryfikacji właściwego wdrożenia.

## Kierunek: osobisty dziennik leków, zaprojektowany dla kobiet

Pierwszy ekran ma odpowiadać na trzy pytania: jaki lek obserwuję, co zapisałam od jego rozpoczęcia i gdzie szybko dodać zmianę. Cykl dostarcza dodatkowego kontekstu. Nie staje się domyślnym ekranem ani narzędziem przewidywania przyczyn objawów.

Charakter wizualny: ciepły, spokojny, redakcyjny. Kremowe płaszczyzny, śliwkowy kontrast, lawendowe akcenty i szałwiowe pola informacji źródłowej. Kobiecość budują materiał, miękkie kształty, typografia i język. Unikamy infantylnych ikon i stereotypowych dekoracji.

## System wizualny

| Element | Decyzja |
| --- | --- |
| Tło | Papierowy krem `#F6F3ED` |
| Tekst | Atrament `#302631` |
| Główna akcja | Śliwka `#4B3048`, biały tekst |
| Akcent osobisty | Lawenda `#E7DDED` |
| Informacja źródłowa | Szałwia `#DEEAE3`, tekst `#284D41` |
| Akcent pomocniczy | Glina `#EADBD1` |
| Tekst pomocniczy | `#756B72`; sprawdzić kontrast na każdym tle |
| Nagłówki | Redakcyjny serif, w makiecie Georgia; docelowo lokalny font z odpowiednią licencją |
| Interfejs | Systemowy sans; docelowo lokalnie załadowany Inter lub podobny font z polskimi znakami |
| Karty | 24–30 px promienia; 16–20 px w środku na telefonie; cień tylko tam, gdzie pomaga hierarchii |
| Przyciski | Minimum 48 px wysokości, główna akcja 54–56 px |
| Ikony | Jedna rodzina autorskich liniowych SVG, 20–24 px, podpisy widoczne |
| Siatka | 16–20 px marginesów telefonu, krok odstępu 4 px |

Karta leku ma dominować. Małe karty nie mogą wyglądać jak kolejne formularze: cykl ma własny okrąg dnia, historia linię czasu, informacja oficjalna oznaczenie źródła. Dane nie są kodowane wyłącznie kolorem.

## Nawigacja i ekrany

### 1. Leki — ekran startowy

- Krótki nagłówek i oznaczenie prywatnego dziennika.
- Karta wybranego leku: nazwa, dawka, data rozpoczęcia, stan zapisanego baseline; dekoracyjna grafika bez sugerowania rzeczywistego wyglądu preparatu.
- Widoczny przycisk „Czuję zmianę” dla wybranego leku. Jedna główna akcja.
- „Twoje leki”: lista z przełączaniem obserwowanego leku i dyskretnym „Dodaj lek”. Bez informacji o przestrzeganiu terapii i bez przypomnień.
- Krótka lista ostatnich obserwacji, z datą i oznaczeniem „Twój zapis”.
- Karta „Cykl jako kontekst” i wejście do informacji źródłowej.
- Pusty stan prowadzi do dodania leku, następnie do krótkiego baseline. Brak dekoracyjnych liczb przy pustej bazie.

### 2. Historia — osobisty przebieg obserwacji

- Kontekst wybranego leku zawsze widoczny.
- Chronologiczna oś: baseline → rozpoczęcie/zmiana leku → objawy.
- Dzień, opis, nasilenie 1–5, notatka; szczegóły w rozwijanym wierszu.
- Cykl i własne odpowiedzi kontekstowe jako dodatkowe dane, bez twierdzenia o przyczynie.
- Wizualna bliskość dat nie oznacza, że lek wywołał objaw.

### 3. Wiedza — „Co wiemy?”

Cztery wyraźnie oddzielone sekcje, także na telefonie:

1. **Twoje doświadczenie** — dane z dziennika, lawendowy akcent.
2. **Oficjalne informacje** — etykieta FDA, źródło, data pobrania, dopasowana nazwa; szałwiowy akcent. Długie fragmenty w dostępnych rozwinięciach.
3. **Zgłoszenia z praktyki** — liczby raportów, wyłącznie jako raporty; etykiety płci i liczby. Bez procentowego „ryzyka”, zdrowotnego wyniku, heatmap zagrożenia i określeń „częsty/rzadki” opartych na FAERS.
4. **Ograniczenia** — stale widoczny skrót oraz rozwinięcie. Raporty nie ustalają przyczynowości ani częstości; dane mogą być niepełne, zduplikowane i bez mianownika.

Makieta pokazuje stan braku wyników zamiast wymyślonych informacji medycznych. Wdrożenie wykorzysta obecny adapter i jego typowane stany: sukces, brak danych, błąd i ładowanie.

### 4. Cykl — kontekst całego dziennika

- Dzień od ostatnio zapisanego początku krwawienia, z podaną datą źródłową; brak wyliczania faz hormonalnych.
- Krótki check-in: nastrój, energia, sen, nawodnienie, własna notatka.
- Ostatnie wpisy, a pod nimi jawne ograniczenia. Bez przewidywania owulacji, płodności lub wyjaśniania objawów hormonami.
- Łączenie z zapisami leków na podstawie dat, bez automatycznej interpretacji klinicznej.

### 5. Dodawanie objawu i leku

Na telefonie panel wysuwany od dołu, na dużym ekranie lekki modal. Formularz jest otwierany na żądanie, dzięki czemu ekran startowy nie staje się ścianą pól.

- Objaw: nazwa → nasilenie 1–5 → data → opcjonalna notatka.
- Opcjonalny opis naturalnym językiem nadal jest przetwarzany wyłącznie przez istniejący adapter draftów.
- Wynik AI: edytowalny szkic, oryginalny tekst, przycisk „Potwierdzam i zapisuję”. Żaden zapis przed potwierdzeniem.
- Lek: nazwa, dawka, data; po zapisie baseline zgodnie z obecną kolejnością.
- Prawdziwy zapis obsługują obecne akcje serwera i walidacja. Nie zmieniamy kontraktów danych w ramach redesignu.

## Responsywność

- 320–767 px: jedna kolumna, dolna nawigacja Leki / Historia / Wiedza / Cykl, podpisy i aktywny stan; uwzględnione safe-area i klawiatura. Na ekranie startowym akcja pod kartą leku, przy dłuższych listach można dodać przycisk w dolnym pasku z odpowiednim odstępem od nawigacji.
- 768–1099 px: główna treść + druga kolumna kontekstu; nadal duże cele dotykowe.
- Od 1100 px: boczna nawigacja, ograniczona szerokość treści, duża karta leku i oddzielna kolumna ostatnich wpisów.
- Panel przewija własną treść i pozostawia przyciski dostępne. Fokus wraca do przycisku otwierającego. Escape zamyka; focus trap działa.

## Grafika i animacja

Grafika startowa utworzona wbudowanym imagegen: `public/design/assets/medication-editorial.png`. Kapsułka, abstrakcyjny blister, śliwkowa wstążka i lawendowe szkło na papierowym tle. Wyłącznie dekoracja, pusty alt. Nie reprezentuje zapisanego leku. W makiecie jest użyta w karcie głównej.

Nie generujemy osobnego zdjęcia każdego leku: mogłoby sugerować tożsamość preparatu. Kolejne grafiki do wdrożenia: jeden neutralny pusty stan dziennika i abstrakcyjna kompozycja cyklu, bez sugerowania faz biologicznych. SVG lepiej nadaje się do ikon i okręgu dnia.

| Ruch | Zachowanie |
| --- | --- |
| Wejście ekranu | 220–320 ms opacity + translateY 8 px, maksymalnie trzy opóźnione grupy |
| Zmiana zakładki | Delikatne pojawienie, bez przesuwania całego interfejsu |
| Panel formularza | 240 ms, wysunięcie od dołu; przyciemnienie tła |
| Przyciski | 120 ms, minimalne przyciśnięcie, widoczny focus |
| Zapis | Krótki komunikat sukcesu, po faktycznym zapisie serwera |
| Cykl | Statyczny łuk dnia, bez animowanego „wyniku zdrowia” |

`prefers-reduced-motion: reduce` wyłącza przejścia, animacje i płynne przewijanie. Brak nieskończonych dekoracyjnych animacji i parallax na telefonach.

## Kolejność wdrożenia

1. **Fundament:** tokeny, fonty lokalne, wspólne przyciski, pola, ikony i stany. Zachować dostępne kontrasty.
2. **MobileShell / BottomNav / DesktopSidebar:** przenieść istniejącą nawigację, zachować parametr wybranego leku. Kolejność zgodna z czterema ekranami.
3. **MedicationHero / MedicationList / RecentObservations:** przebudować stronę główną wokół leków; podłączyć obecne dane i akcje.
4. **EntrySheet:** przenieść istniejące formularze leku, baseline, objawu i szkicu AI do dostępnego panelu. Zachować walidację i potwierdzenie AI.
5. **TimelineView:** wyrównać daty, markery, źródła danych i szczegóły.
6. **EvidenceTile:** przebudować „Co wiemy?” na cztery sekcje, zachować źródła, stany braku danych i ograniczenia.
7. **CycleContextCard / CycleCheckIn:** odświeżyć cykl i kontekst objawu w tej samej rodzinie wizualnej.
8. **MotionReveal / grafiki:** dodać wyłącznie lekkie animacje i zoptymalizowany obraz przez next/image.
9. **Sprawdzenie:** 320, 390, 768 i 1440 px; klawiatura, powiększenie, reduced-motion; zapis → odświeżenie → trwała oś; aktualne testy integracji i build.

Nie dodajemy w ramach redesignu diagnozy, wykluczania chorób, czatu, przypomnień, autoryzacji, raportu lekarza, prognoz faz cyklu ani nowych integracji. Podsumowanie dla lekarza pozostaje osobną przyszłą funkcją.

## Kryteria gotowego wdrożenia

- Nazwa, dawka i data wybranego leku czytelne bez przewijania na typowym telefonie.
- Główna akcja do dodania zmiany dostępna bez poszukiwania formularza.
- Brak przewijania w poziomie przy 320 px; navigation i przyciski nie zasłaniają treści.
- Semantyczne formularze, czytelne błędy, minimum 48 px celów dotykowych.
- Czytelny focus i kontrast WCAG AA zweryfikowany dla gotowych par kolorów.
- Każda informacja medyczna zachowuje rzeczywiste źródło; brak danych to jawny stan.
- Żadnej treści AI w bazie przed potwierdzeniem; wygląd nie zmienia tej zasady.
- Osobisty dziennik odróżniony od źródeł FDA. Liczby raportów nie wyglądają jak prawdopodobieństwa.
- Lekki obraz z ustalonymi wymiarami i responsywnymi wariantami; brak skoków układu.
- Polski interfejs spójny na wszystkich ekranach po wdrożeniu, bez mieszania nazw przycisków.

## Prompt wykorzystanej grafiki

Narzędzie: wbudowane imagegen. Tło nieprzezroczyste. Oryginał zachowany w folderze generated_images, kopia w repozytorium.

> Create a premium editorial product still life for a women's medication journal mobile app called SideEffectHer. No text, no letters, no logos. Landscape composition 3:2. Sculptural unbranded ivory capsule and a small silver empty medication blister silhouette with rounded edges, nestled beside a flowing burgundy plum satin ribbon, a translucent pale lavender glass pebble and softly folded cream paper. Sophisticated feminine art direction, quiet contemporary designer aesthetic, warm ivory studio background #F6F1EA, plum #493145, dusty mauve, muted sage. Tactile matte ceramic and brushed metal, natural soft directional sunlight from upper left, delicate shadows, refined photographic 3D still life. Arrange the entire objects mostly in the right two thirds, leave spacious plain ivory negative space at left. Close crop but all important objects in frame. Decorative conceptual medicine imagery, no identifiable drug packaging, no dosage, no anatomical imagery, no people, no pink hearts, no glitter, no flowers, no medical cross, no glossy stock-photo aesthetic. Sharp high quality, restrained beautiful composition for a professional mobile health app.
## Wdrożenie do aplikacji — 3 października 2026

Zaakceptowany kierunek jest wdrożony w działającej aplikacji. Makieta pozostaje jako materiał referencyjny.

- `/`: wybrany lek z prawdziwą nazwą, dawką i datą; zapis punktu wyjścia; panel objawu; wybór i dodawanie leków; ostatnie obserwacje.
- `/timeline`: osobna chronologiczna historia leków i zapisanych objawów.
- `/what-we-know`: cztery odrębne sekcje, rzeczywiste źródła, stany brakujących lub niedostępnych danych i liczby raportów bez interpretacji ryzyka.
- `/cycle` i `/context`: formularze zapisujące rzeczywiste obserwacje, daty i odpowiedzi do istniejącej bazy.
- Szkic AI nadal wymaga sprawdzenia pól i zaznaczenia potwierdzenia przed zapisem. Konfiguracja integracji pozostaje opcjonalna.
- Nawigacja mobilna zachowuje wybrany lek. Panele mają semantykę dialogu, zamykanie klawiszem Escape i przywracanie fokusu. Animacje respektują reduced-motion.
- Nowe ekrany korzystają z lokalnych fontów i wygenerowanej grafiki. Grafika ma charakter dekoracyjny i nie przedstawia konkretnego produktu leczniczego.

Sprawdzenie: dodanie leku → baseline → objaw → odświeżenie historii; zapis dat krwawienia i check-inu; zapis kontekstu; szerokości 320 i 390 px; zamknięcie panelu klawiaturą; typecheck, 18 testów oraz build. Dane testowe zapisano w osobnym dzienniku przeglądarkowym. Zmiana UI nie wymaga migracji.

## Rozszerzenie cyklu i czytelność etykiet — 3 października 2026

Na kolejne życzenie użytkownika dodano osobną, opcjonalną mapę cyklu. Zapisane krwawienie pozostaje faktem z dziennika, a etapy i zakres możliwej owulacji są wyraźnie oznaczone jako ilustracja kalendarzowa. Nie ma pomiaru hormonów, procentów płodności ani bezpiecznych dni. Przy nieznanym kontekście, wpływie hormonów, niewystarczającej lub zmiennej historii szacunki nie są wyświetlane. Dodanie leku wymaga ponownego potwierdzenia kontekstu. Warunki i źródła NHS opisano w README oraz na ekranie.

Po pojedynczym zapisie objawu dostępne są opcjonalne pytania o codzienny kontekst. Odpowiedzi i check-iny pokazujemy jako zapisy użytkowniczki, obok ogólnych informacji NHS. Nie ustalamy przyczyny i nie wykluczamy leku.

Sekcje etykiet FDA otrzymały osobne nagłówki, karty z numeracją, literalne nagłówki źródła oraz oznaczenia ciągu dalszego. Tekst, kolejność i warunki stosowania pozostają zachowane. Pełny oryginał można rozwinąć. Podział jest deterministyczny i nie wykorzystuje LLM.

Weryfikacja: 23 testy, typecheck, build; zapis i odświeżenie odpowiedzi; blokada bez potwierdzenia; blokada bez historii; szacunki po czterech początkach miesiączki; wyłączenie szacunków po dodaniu leku. Migracja cycle_profiles została zastosowana w lokalnym Dockerze.
