/* Ready-made patterns: palette buttons that drop several shapes at once, a login form, a settings page and so on.
   A pattern is a piece of .flow text, not a shape type. The UI patterns here are flexi containers ([flow=column],
   [flow=row]) all the way down, so only the outermost one has a position and everything in it is laid out for it;
   the programming ones (code-patterns.ts) place each shape inside their frame. Either way it goes into the text of
   the current page (placePattern in engine/palette.ts), so it's ordinary shapes from then on, each with its own
   line. Ids are made unique on the page as it goes in (patternLines), and [in=] and connections follow the renames. */
import {renameInLine, uniqueFid} from '../engine/flow/language'
import {ALGORITHM_PATTERNS, ARCHITECTURE_PATTERNS, DESIGN_PATTERNS, ML_PATTERNS} from './code-patterns'

/* The palette's pattern groups, in order */
export const PATTERN_GROUPS = {
    ui: 'UI patterns', design: 'Design patterns', architecture: 'Architecture', algorithm: 'Algorithms',
    ml: 'Machine learning'
} as const
export type PatternGroup = keyof typeof PATTERN_GROUPS

export type Pattern = {
    name: string        // data-pattern on its palette button
    label: string
    title: string
    icon: string        // SVG markup in a 44x28 box, like a shape's palette icon
    w: number, h: number   // how big it comes out, in mm (measured off docs/diagrams/patterns.png), to centre it
    lines: string[]     // its statements; the first is the outermost container, at @ 0,0
    /* its walk-through for present mode: step lines (step 1, then $id changes...) numbered from 1, added to the
       file's @animation block after any steps already there (addSteps in engine/flow/language.ts) */
    animation?: string[]
    group: PatternGroup
}

const UI_PATTERNS: Omit<Pattern, 'group'>[] = [
    {
        name: 'login', label: 'Login form', title: 'Login form: email, password, keep me signed in and a button',
        icon: '<path d="M8 2H36V26H8Z"/><path d="M8 7H36M11 10H33V13H11ZM11 15H33V18H11ZM11 21H33V24H11Z"/>',
        w: 76, h: 122,
        lines: [
            'login: container "Log in" @ 0,0 [flow=column]',
            'email: field "Email" [in=login]',
            'password: password "••••••••" [in=login]',
            'keep: checkbox "Keep me signed in" [in=login]',
            'log_in: button "Log in" [in=login]',
            'forgot: text "Forgot your password?" [in=login]',
            'about: text "A login form: the one screen between a returning user and their account. Use it for any app with accounts; keep it short, say which field is wrong, and always offer a way back in." 63x26 [in=login]',
        ],
        animation: [
            'step 1',
            '   $email [fill=#FFE38A stroke=#E69138]',
            '   $about "The email (or username) says who is signing in."',
            'step 2',
            '   $email [fill=#FFFFFF stroke=#2B3A47]',
            '   $password [fill=#FFE38A stroke=#E69138]',
            '   $about "The password proves it. Mask it, but let people show it."',
            'step 3',
            '   $password [fill=#FFFFFF stroke=#2B3A47]',
            '   $keep [stroke=#E69138]',
            '   $about "\\"Keep me signed in\\" saves logging in again on a trusted device."',
            'step 4',
            '   $keep [stroke=#2B3A47]',
            '   $log_in [fill=#FFE38A stroke=#E69138]',
            '   $about "One clear button sends the form."',
            'step 5',
            '   $log_in [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A login form: the one screen between a returning user and their account. Use it for any app with accounts; keep it short, say which field is wrong, and always offer a way back in."',
        ]
    },
    {
        name: 'signup',
        label: 'Sign-up form',
        title: 'Sign-up form: name, email, password, terms, a robot check and a button',
        icon: '<path d="M8 1H36V27H8Z"/><path d="M8 5H36M11 7H33V9.5H11ZM11 11.5H33V14H11ZM11 16H33V18.5H11ZM11 21H13V23H11ZM15 22H30"/>',
        w: 89,
        h: 163,
        lines: [
            'signup: container "Create an account" @ 0,0 [flow=column]',
            'full_name: field "Full name" [in=signup]',
            'email: field "Email" [in=signup]',
            'password: password "••••••••" [in=signup]',
            'terms: checkbox "I agree to the terms" [in=signup]',
            'robot: captcha "I’m not a robot" [in=signup]',
            'sign_up: button "Sign up" [in=signup]',
            'or: divider "or" [in=signup]',
            'google: button "Continue with Google" [in=signup]',
            'about: text "A sign-up form: creates a new account. Use it as the start of onboarding; ask for as little as you can, and offer a social sign-in for speed." 76x22 [in=signup]',
        ],
        animation: [
            'step 1',
            '   $full_name [fill=#FFE38A stroke=#E69138]',
            '   $email [fill=#FFE38A stroke=#E69138]',
            '   $password [fill=#FFE38A stroke=#E69138]',
            '   $about "Only the details the account needs."',
            'step 2',
            '   $full_name [fill=#FFFFFF stroke=#2B3A47]',
            '   $email [fill=#FFFFFF stroke=#2B3A47]',
            '   $password [fill=#FFFFFF stroke=#2B3A47]',
            '   $terms [stroke=#E69138]',
            '   $about "Agreeing to the terms is a deliberate tick, never pre-ticked."',
            'step 3',
            '   $terms [stroke=#2B3A47]',
            '   $robot [fill=#FFE38A stroke=#E69138]',
            '   $about "A robot check keeps fake accounts out."',
            'step 4',
            '   $robot [fill=#E9EEF2 stroke=#2B3A47]',
            '   $sign_up [fill=#FFE38A stroke=#E69138]',
            '   $about "The main button creates the account."',
            'step 5',
            '   $sign_up [fill=#FFFFFF stroke=#2B3A47]',
            '   $google [fill=#FFE38A stroke=#E69138]',
            '   $about "Or skip the form with an account people already have."',
            'step 6',
            '   $google [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A sign-up form: creates a new account. Use it as the start of onboarding; ask for as little as you can, and offer a social sign-in for speed."',
        ]
    },
    {
        name: 'settings', label: 'Settings page', title: 'Settings page: a sidebar menu and a column of settings',
        icon: '<path d="M2 2H42V26H2Z"/><path d="M2 6H42M14 6V26M5 9H11M5 13H11M5 17H11M18 10H30M35 9H39V12H35ZM18 15H30M35 14H39V17H35ZM18 20H38V23H18Z"/>',
        w: 197,
        h: 121,
        lines: [
            'settings: container "Settings" @ 0,0 [flow=row]',
            'menu: sidebar "Account | Notifications | Privacy" [in=settings]',
            'account: container "Account" [flow=column in=settings]',
            'display_name: formfield "Display name | Ana Smith | Shown on your profile" [in=account]',
            'alerts: switch "Email alerts" [state=on in=account]',
            'dark: switch "Dark mode" [in=account]',
            'language: dropdown "English" [in=account]',
            'save: button "Save" [in=account]',
            'about: text "A settings page: a menu of sections beside the settings in the chosen one. Use it when an app has more options than fit one screen; group them so people can find them." 60x26 [in=settings]',
        ],
        animation: [
            'step 1',
            '   $menu [fill=#FFE38A stroke=#E69138]',
            '   $about "The sidebar lists the sections; the open one is lit."',
            'step 2',
            '   $menu [fill=#1F6F78 stroke=#2B3A47]',
            '   $display_name [fill=#FFE38A stroke=#E69138]',
            '   $about "Each setting has a name, its value and a hint."',
            'step 3',
            '   $display_name [fill=#FFFFFF stroke=#2B3A47]',
            '   $alerts [fill=#FFE38A stroke=#E69138]',
            '   $dark [fill=#FFE38A stroke=#E69138]',
            '   $about "Switches for things that are simply on or off."',
            'step 4',
            '   $alerts [fill=#1F6F78 stroke=#2B3A47]',
            '   $dark [fill=#1F6F78 stroke=#2B3A47]',
            '   $language [fill=#FFE38A stroke=#E69138]',
            '   $about "A dropdown when there are several choices."',
            'step 5',
            '   $language [fill=#FFFFFF stroke=#2B3A47]',
            '   $save [fill=#FFE38A stroke=#E69138]',
            '   $about "Save applies the changes."',
            'step 6',
            '   $save [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A settings page: a menu of sections beside the settings in the chosen one. Use it when an app has more options than fit one screen; group them so people can find them."',
        ]
    },
    {
        name: 'cookies', label: 'Cookie banner', title: 'Cookie banner: the message, then accept and settings buttons',
        icon: '<path d="M2 8H42V22H2Z"/><path d="M2 11H42M5 16H22M25 14H32V19H25ZM34 14H40V19H34Z"/>',
        w: 222, h: 50,
        lines: [
            'cookies: container "Cookies" @ 0,0 [flow=row align=center]',
            'cookie_text: text "We use cookies to make this site work and to improve it." [in=cookies]',
            'accept: button "Accept all" [in=cookies]',
            'cookie_settings: button "Settings" [in=cookies]',
            'about: text "A cookie banner: asks permission to use non-essential cookies. Required on many sites by law; make accepting and choosing equally easy." 60x22 [in=cookies]',
        ],
        animation: [
            'step 1',
            '   $accept [fill=#FFE38A stroke=#E69138]',
            '   $about "Accept all: one click to agree."',
            'step 2',
            '   $accept [fill=#FFFFFF stroke=#2B3A47]',
            '   $cookie_settings [fill=#FFE38A stroke=#E69138]',
            '   $about "Settings: choose which kinds to allow."',
            'step 3',
            '   $cookie_settings [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A cookie banner: asks permission to use non-essential cookies. Required on many sites by law; make accepting and choosing equally easy."',
        ]
    },
    {
        name: 'search', label: 'Search results', title: 'Search results: a search box, filters, results and pages',
        icon: '<path d="M6 1H38V27H6Z"/><path d="M6 5H38M9 7H35V10H9ZM9 12H15M17 12H23M9 15H35V22H9ZM9 17.5H35M9 19.5H35M17 24H27"/>',
        w: 77,
        h: 115,
        lines: [
            'results: container "Search" @ 0,0 [flow=column]',
            'query: search "Search…" [in=results]',
            'filters: pills "All | Images | News" [in=results]',
            'hits: list "First result | Second result | Third result" [in=results]',
            'pages: pagination "‹ | 1 | 2 | 3 | ›" [in=results]',
            'about: text "Search results: a query, filters, the matches and paging. Use it wherever there is more content than people can browse; filters narrow the results without a new search." 64x26 [in=results]',
        ],
        animation: [
            'step 1',
            '   $query [fill=#FFE38A stroke=#E69138]',
            '   $about "What was searched for, editable in place."',
            'step 2',
            '   $query [fill=#FFFFFF stroke=#2B3A47]',
            '   $filters [stroke=#E69138]',
            '   $about "Filters narrow the results by kind."',
            'step 3',
            '   $filters [stroke=#2B3A47]',
            '   $hits [fill=#FFE38A stroke=#E69138]',
            '   $about "The matches, best first."',
            'step 4',
            '   $hits [fill=#1F6F78 stroke=#2B3A47]',
            '   $pages [fill=#FFE38A stroke=#E69138]',
            '   $about "Pages, when there are too many to show at once."',
            'step 5',
            '   $pages [fill=#1F6F78 stroke=#2B3A47]',
            '   $about "Search results: a query, filters, the matches and paging. Use it wherever there is more content than people can browse; filters narrow the results without a new search."',
        ]
    },
    {
        name: 'chat', label: 'Chat', title: 'Chat: a conversation, bubbles left and right, and a box to write in',
        icon: '<path d="M6 1H38V27H6Z"/><path d="M6 5H38M10 8H24V11H10ZM20 13H34V16H20ZM10 18H26V21H10ZM9 23H35V26H9Z"/>',
        w: 76,
        h: 115,
        lines: [
            'chat: container "Ana Smith" @ 0,0 [flow=column]',
            'msg1: chatbubble "Are we still on for 3pm?" [in=chat]',
            'msg2: chatbubble "Yes, see you there!" [side=right in=chat]',
            'msg3: chatbubble "Great, I’ll book a room" [in=chat]',
            'reply: field "Write a message…" [in=chat]',
            'about: text "A chat: a conversation between two people, theirs on the left and yours on the right. Use it for messaging and support; the newest message sits at the bottom, next to the box to reply in." 63x26 [in=chat]',
        ],
        animation: [
            'step 1',
            '   $msg1 [fill=#FFE38A stroke=#E69138]',
            '   $about "Their message: on the left."',
            'step 2',
            '   $msg1 [fill=#E9EEF2 stroke=#2B3A47]',
            '   $msg2 [fill=#FFE38A stroke=#E69138]',
            '   $about "Your reply: on the right, in your colour."',
            'step 3',
            '   $msg2 [fill=#E9EEF2 stroke=#2B3A47]',
            '   $msg3 [fill=#FFE38A stroke=#E69138]',
            '   $about "The conversation reads down the screen."',
            'step 4',
            '   $msg3 [fill=#E9EEF2 stroke=#2B3A47]',
            '   $reply [fill=#FFE38A stroke=#E69138]',
            '   $about "Write the next message here."',
            'step 5',
            '   $reply [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A chat: a conversation between two people, theirs on the left and yours on the right. Use it for messaging and support; the newest message sits at the bottom, next to the box to reply in."',
        ]
    },
    {
        name: 'storelocator',
        label: 'Store locator',
        title: 'Store locator: a search box and the nearest stores beside a map',
        icon: '<path d="M2 2H42V26H2Z"/><path d="M2 6H42M5 9H17V12H5ZM5 14H17M5 18H17M5 22H17M20 9H39V24H20Z"/><path d="M20 17H39M29 9V24"/><path d="M29 14A2 2 0 1 1 29.1 14L29 17"/>',
        w: 218,
        h: 83,
        lines: [
            'stores: container "Find a store" @ 0,0 [flow=row]',
            'finder: container "Near you" [flow=column in=stores]',
            'postcode: search "Postcode or town" [in=finder]',
            'nearby: list "Leeds, 0.4 miles | York, 22 miles | Hull, 54 miles" [in=finder]',
            'store_map: mapview "Leeds" [in=stores]',
            'about: text "A store locator: search for a place, see the nearest stores in a list beside a map. Use it for any business people visit in person." 60x22 [in=stores]',
        ],
        animation: [
            'step 1',
            '   $postcode [fill=#FFE38A stroke=#E69138]',
            '   $about "Search by postcode or town."',
            'step 2',
            '   $postcode [fill=#FFFFFF stroke=#2B3A47]',
            '   $nearby [fill=#FFE38A stroke=#E69138]',
            '   $about "The nearest stores, closest first, with the distance."',
            'step 3',
            '   $nearby [fill=#1F6F78 stroke=#2B3A47]',
            '   $store_map [fill=#FFE38A stroke=#E69138]',
            '   $about "The map shows where they are."',
            'step 4',
            '   $store_map [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A store locator: search for a place, see the nearest stores in a list beside a map. Use it for any business people visit in person."',
        ]
    },
    {
        name: 'directions', label: 'Directions', title: 'Directions: the route step by step beside a map',
        icon: '<path d="M2 2H42V26H2Z"/><path d="M2 6H42M5 9H18V24H5ZM5 13H18M5 17H18M5 21H18M21 9H39V24H21Z"/><path d="M21 17H39M30 9V24"/><path d="M30 14A2 2 0 1 1 30.1 14L30 17"/>',
        w: 210,
        h: 79,
        lines: [
            'route: container "Directions" @ 0,0 [flow=row]',
            'steps: directions "From: Leeds | To: York | Turn left onto the A64 | Turn right at the roundabout | Continue for 20 miles" [in=route]',
            'route_map: mapview "Leeds to York" [in=route]',
            'about: text "Directions: a route as a list of turns beside a map of it. Use it for travel and delivery apps; the list is easier to follow, the map easier to picture." 60x26 [in=route]',
        ],
        animation: [
            'step 1',
            '   $steps [fill=#FFE38A stroke=#E69138]',
            '   $about "From, to, then each turn in order."',
            'step 2',
            '   $steps [fill=#1F6F78 stroke=#2B3A47]',
            '   $route_map [fill=#FFE38A stroke=#E69138]',
            '   $about "The whole route on a map."',
            'step 3',
            '   $route_map [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "Directions: a route as a list of turns beside a map of it. Use it for travel and delivery apps; the list is easier to follow, the map easier to picture."',
        ]
    },
    {
        name: 'dashboard', label: 'Dashboard', title: 'Dashboard layout: a nav bar, a row of KPI cards and two charts',
        icon: '<path d="M2 1H42V27H2Z"/><path d="M2 5H42M5 8H15V13H5ZM17 8H27V13H17ZM29 8H39V13H29ZM5 16H21V24H5ZM23 16H39V24H23Z"/><path d="M8 23V20M11 23V18M14 23V21M26 22 30 19 33 21 37 17"/>',
        w: 155,
        h: 165,
        lines: [
            'dashboard: container "Dashboard" @ 0,0 [flow=column]',
            'nav: navbar "Brand | Overview | Reports | Settings" [in=dashboard]',
            'kpis: container "This month" [flow=row in=dashboard]',
            'visitors: kpi "1,204\\nVisitors" [in=kpis]',
            'conversion: kpi "3.6%\\nConversion" [in=kpis]',
            'revenue: kpi "£8.2k\\nRevenue" [in=kpis]',
            'charts: container "Trends" [flow=row in=dashboard]',
            'sales: bar "Sales" [in=charts]',
            'visits: line "Visits" [in=charts]',
            'about: text "A dashboard: the few numbers that matter, then the trends behind them. Use it as an app\'s home screen or a report; the headline figures go at the top, the detail below." 142x13 [in=dashboard]',
        ],
        animation: [
            'step 1',
            '   $nav [fill=#FFE38A stroke=#E69138]',
            '   $about "The navigation bar: where you are, and other reports."',
            'step 2',
            '   $nav [fill=#1F6F78 stroke=#2B3A47]',
            '   $visitors [fill=#FFE38A stroke=#E69138]',
            '   $conversion [fill=#FFE38A stroke=#E69138]',
            '   $revenue [fill=#FFE38A stroke=#E69138]',
            '   $about "KPI cards: this month\'s headline figures."',
            'step 3',
            '   $visitors [fill=#1F6F78 stroke=#2B3A47]',
            '   $conversion [fill=#1F6F78 stroke=#2B3A47]',
            '   $revenue [fill=#1F6F78 stroke=#2B3A47]',
            '   $sales [fill=#FFE38A stroke=#E69138]',
            '   $visits [fill=#FFE38A stroke=#E69138]',
            '   $about "Charts show how they got there."',
            'step 4',
            '   $sales [fill=#1F6F78 stroke=#2B3A47]',
            '   $visits [fill=#FFFFFF stroke=#2B3A47]',
            '   $about "A dashboard: the few numbers that matter, then the trends behind them. Use it as an app\'s home screen or a report; the headline figures go at the top, the detail below."',
        ]
    },
    {
        name: 'journey',
        label: 'Journey map',
        title: 'Customer journey map: stages along the top, a step and a feeling under each',
        icon: '<path d="M2 2H42V26H2Z"/><path d="M2 6H42M5 9H14L16 11 14 13H5ZM17 9H26L28 11 26 13H17ZM29 9H38L40 11 38 13H29Z"/><circle cx="10" cy="20" r="2.5"/><circle cx="22" cy="20" r="2.5"/><circle cx="34" cy="20" r="2.5"/>',
        w: 316,
        h: 81,
        lines: [
            'journey: container "Customer journey" @ 0,0 [flow=row gap=6]',
            'discover: container "Discover" [flow=column align=center in=journey]',
            'find: sticky "Finds us on search" 40x18 [in=discover]',
            'find_mood: mood "Curious" [face=laughing in=discover]',
            'sign_up: container "Sign up" [flow=column align=center in=journey]',
            'form: sticky "Fills in a long form" 40x18 [in=sign_up]',
            'form_mood: mood "Frustrated" [face=angry in=sign_up]',
            'use: container "Use" [flow=column align=center in=journey]',
            'first: sticky "First order arrives" 40x18 [in=use]',
            'first_mood: mood "Happy" [in=use]',
            'about: text "A customer journey map: the stages someone goes through, what happens at each and how they feel. Use it to find the points where people get stuck or give up." 60x26 [in=journey]',
        ],
        animation: [
            'step 1',
            '   $find [fill=#FFE38A stroke=#E69138]',
            '   $find_mood [fill=#FFE38A stroke=#E69138]',
            '   $about "Discover: they find you, and they\'re curious."',
            'step 2',
            '   $find [fill=#FFE38A stroke=#2B3A47]',
            '   $find_mood [fill=#C7D7B8 stroke=#2B3A47]',
            '   $form [fill=#FFE38A stroke=#E69138]',
            '   $form_mood [fill=#FFE38A stroke=#E69138]',
            '   $about "Sign up: a long form frustrates them."',
            'step 3',
            '   $form [fill=#FFE38A stroke=#2B3A47]',
            '   $form_mood [fill=#E7BFC1 stroke=#2B3A47]',
            '   $first [fill=#FFE38A stroke=#E69138]',
            '   $first_mood [fill=#FFE38A stroke=#E69138]',
            '   $about "Use: the first order arrives, and they\'re happy."',
            'step 4',
            '   $first [fill=#FFE38A stroke=#2B3A47]',
            '   $first_mood [fill=#C7D7B8 stroke=#2B3A47]',
            '   $about "A customer journey map: the stages someone goes through, what happens at each and how they feel. Use it to find the points where people get stuck or give up."',
        ]
    },
    {
        name: 'kanban', label: 'Kanban board', title: 'Kanban board: to do, doing and done columns of sticky notes',
        icon: '<path d="M2 2H42V26H2Z"/><path d="M2 6H42M15.3 6V26M28.7 6V26M5 9H12V13H5ZM5 15H12V19H5ZM18 9H26V13H18ZM32 9H39V13H32ZM32 15H39V19H32Z"/>',
        w: 316,
        h: 80,
        lines: [
            'kanban: container "Board" @ 0,0 [flow=row gap=6]',
            'todo: container "To do" [flow=column in=kanban]',
            'doing: container "Doing" [flow=column in=kanban]',
            'done: container "Done" [flow=column in=kanban]',
            'brief: sticky "Write the brief" 40x18 [in=todo]',
            'sketches: sticky "Sketch screens" 40x18 [in=todo]',
            'login: sticky "Login page" 40x18 [in=doing]',
            'setup: sticky "Project setup" 40x18 [in=done]',
            'repo: sticky "Make the repo" 40x18 [in=done]',
            'about: text "A kanban board: work as cards moving through columns. Use it to plan a team\'s work; anyone can see what is waiting, what is being done and what is finished." 60x26 [in=kanban]',
        ],
        animation: [
            'step 1',
            '   $brief [fill=#FFE38A stroke=#E69138]',
            '   $sketches [fill=#FFE38A stroke=#E69138]',
            '   $about "To do: work waiting to start."',
            'step 2',
            '   $brief [fill=#FFE38A stroke=#2B3A47]',
            '   $sketches [fill=#FFE38A stroke=#2B3A47]',
            '   $login [fill=#FFE38A stroke=#E69138]',
            '   $about "Doing: work in progress. Keep this column short."',
            'step 3',
            '   $login [fill=#FFE38A stroke=#2B3A47]',
            '   $setup [fill=#FFE38A stroke=#E69138]',
            '   $repo [fill=#FFE38A stroke=#E69138]',
            '   $about "Done: finished work."',
            'step 4',
            '   $setup [fill=#FFE38A stroke=#2B3A47]',
            '   $repo [fill=#FFE38A stroke=#2B3A47]',
            '   $login [in=done fill=#FFE38A stroke=#E69138]',
            '   $about "The login page is finished, so its card moves to Done."',
            'step 5',
            '   $login [fill=#FFE38A stroke=#2B3A47]',
            '   $brief [in=doing fill=#FFE38A stroke=#E69138]',
            '   $about "Doing has room now, so someone picks up the brief: it moves to Doing."',
            'step 6',
            '   $brief [fill=#FFE38A stroke=#2B3A47]',
            '   $about "A kanban board: work as cards moving through columns. Use it to plan a team\'s work; anyone can see what is waiting, what is being done and what is finished."',
        ]
    },
]

export const PATTERNS: Pattern[] = [
    ...UI_PATTERNS.map(p => ({...p, group: 'ui' as const})),
    ...DESIGN_PATTERNS.map(p => ({...p, group: 'design' as const})),
    ...ARCHITECTURE_PATTERNS.map(p => ({...p, group: 'architecture' as const})),
    ...ALGORITHM_PATTERNS.map(p => ({...p, group: 'algorithm' as const})),
    ...ML_PATTERNS.map(p => ({...p, group: 'ml' as const})),
]

const ID_LINE = /^([A-Za-z_][\w-]*)\s*:/
const QUOTED_OR_AT = /"(?:[^"\\]|\\.)*"|@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g

/* A pattern's lines ready to go in a page: moved so its top-left corner is at x, y (mm), and every id renamed if
   it's taken, along with the [in=] and connections that name it (renameInLine). used holds the ids already taken,
   and gets the new ones added. Returns the lines, the first shape's id and every id's new name (for its steps). */
export function patternLines(p: Pattern, x: number, y: number, used: Set<string>): {
    lines: string[],
    id: string,
    ids: Map<string, string>
} {
    const ids = new Map<string, string>()
    for (const l of p.lines) {
        const m = l.match(ID_LINE)
        if (!m) continue
        const id = uniqueFid(m[1], used)
        used.add(id)
        ids.set(m[1], id)
    }
    const ox = Math.max(0, x), oy = Math.max(0, y), at = (n: number) => +n.toFixed(1)   // kept on the page as a whole
    const lines = p.lines.map(l => renameInLine(l, ids)
        .replace(QUOTED_OR_AT, (all, px?: string, py?: string) => px == null ? all : `@ ${at(+px + ox)},${at(+py! + oy)}`))
    return {lines, id: ids.get(p.lines[0].match(ID_LINE)![1])!, ids}
}
