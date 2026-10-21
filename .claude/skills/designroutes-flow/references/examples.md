# Example flows

Copied from `docs/diagrams/*.flow` by `scripts/build-flow-skill.mjs`; edits here are overwritten. Every one of these
parses cleanly and is drawn by the editor for the docs (the PNG beside each source in `docs/diagrams`).

## language-example

A small flowchart with a chart, two database tables joined by a crow's foot, and a key.

```
flow 1
page "Orders" size 304x163 direction LR

# A small example of the .flow language, used in docs/flow-language.md.
# Comments start with # at the start of a line or after a space.

start: terminator "Order placed" @ 15,20
check: decision "In stock?" @ 75,15 40x24
pick: process "Pick and pack" @ 145,20 [fill=#DCE3EB]
wait: process "Back-order" @ 145,60
ship: terminator "Shipped" @ 215,20
sales: bar "Orders per day" { 3, 5, 2, 7 } @ 15,60 50x34
orders: table "orders" { id; customer_id; placed_at } @ 75,60 40x30
customers: table "customers" { id; name; email } @ 15,105 40x30

start -> check
check -> pick : "yes"
check -alt-> wait [weight=1.5] : "no"
wait ..> pick : "when it arrives"
pick -> ship
customers ||--o{ orders

key "Key" @ 145,95
```

## swimlanes

A pool of lanes; every box names its lane with `in=`, and nothing is placed by hand.

```
flow 1

# Containers and swimlanes, for the README. Every box names the lane it's in with [in=...]; nothing is placed by
# hand, so the lanes are stacked in the pool and each lane is laid out round what's in it.

page "Swimlanes" size 190x142 direction LR

orders: pool "Order process"
customer: lane "Customer" [in=orders]
shop: lane "Shop" [in=orders]
warehouse: lane "Warehouse" [in=orders]

order: terminator "Order placed" [in=customer]
paid: process "Pay" [in=customer]
check: decision "In stock?" [in=shop]
confirm: process "Confirm order" [in=shop]
pick: process "Pick and pack" [in=warehouse]
ship: terminator "Shipped" [in=warehouse]

order -> paid
paid -> check
check -> confirm : "yes"
confirm -> pick
pick -> ship
```

## kanban

Flexi containers: a row of columns, each a column of cards, in line order.

```
flow 1

# Flexi containers, for the README: a row of columns, each a column of cards. Nothing is placed by hand; the
# order of the lines is the order on the board, and dragging a card to another spot reorders them.

page "Kanban" size 283x136

board: container "Sprint 12" [flow=row gap=6]
todo: container "To do" [flow=column in=board]
doing: container "Doing" [flow=column in=board]
done: container "Done" [flow=column in=board]

c1: process "Password reset" [in=todo]
c2: process "Export to PDF" [in=todo]
c3: process "Dark mode" [in=todo]
c4: process "Sign-up form" [in=doing]
c5: process "Login page" [in=done]
c6: process "Project setup" [in=done]
```

## mind-map

A mind map: indentation is the hierarchy, with no connections.

```
flow 1

# A mind map, for the README: the topics under the central topic are its topics, each indented under the topic it
# hangs off, with no connections to write. Nothing is placed by hand: the map lays them out on both sides.

page "Mind map" size 279x116
idea: centraltopic "New website"
goals: topic "Goals"
  g1: topic "More sign-ups"
  g2: topic "Faster pages"
users: topic "Users"
  u1: topic "Shoppers"
  u2: topic "Staff"
  u3: topic "Partners"
content: topic "Content"
  c1: topic "Blog"
tech: topic "Tech"
  t1: topic "React"
  t2: topic "Hosting"
```

## org-chart

Person cards joined by plain connections, laid out as a tree automatically.

```
flow 1

# Person cards and plain connections, for the README: nothing is placed by hand, so the automatic layout
# (top to bottom) arranges them as a tree.

page "Org" size 220x117
ceo: personcard "Ana Silva\nChief executive"
cto: personcard "Ben Okafor\nTechnology"
cfo: personcard "Cara Lee\nFinance"
dev1: personcard "Dan Wu\nEngineer"
dev2: personcard "Eve Shah\nEngineer"
acc: personcard "Fay Ruiz\nAccountant"
ceo -> cto
ceo -> cfo
cto -> dev1
cto -> dev2
cfo -> acc
```

## scroll-area

A scroll area that is also a column flexi container.

```
flow 1

# A scroll area, for the README: it keeps its size, cuts off what doesn't fit and shows how much does in its
# scrollbar. Here it's a column flexi container too, so the results stack themselves.

page "Scroll area" size 110x100

results: scroll "Search results" @ 15,15 80x70 [flow=column gap=3]
r1: process "Flow editor: diagrams as text" [in=results]
r2: process "Swimlanes in five minutes" [in=results]
r3: process "Importing Visio drawings" [in=results]
r4: process "Kanban boards with flexi containers" [in=results]
r5: process "Exporting to draw.io" [in=results]
r6: process "Keyboard shortcuts" [in=results]
```

## connection-types

Every connection type, placed by hand, with the page key.

```
flow 1
page "Connection types" size 440x314 direction LR

# Every connection type, labelled with what you type to get it. The key at the bottom is the
# page's own key (key "..."): it lists each type used on the page with its meaning, by itself.

h1: text "Process flow" @ 15,8 120x8
f1: process "A" @ 15,20 24x12
f2: process "B" @ 105,20 24x12
d1: process "A" @ 15,40 24x12
d2: process "B" @ 105,40 24x12
m1: process "A" @ 15,60 24x12
m2: process "B" @ 105,60 24x12
a1: process "A" @ 15,80 24x12
a2: process "B" @ 105,80 24x12
w1: process "A" @ 15,100 24x12
w2: process "B" @ 105,100 24x12
n1: process "A" @ 15,120 24x12
n2: process "B" @ 105,120 24x12

h2: text "System relationships" @ 155,8 120x8
p1: process "A" @ 155,20 24x12
p2: process "B" @ 245,20 24x12
s1: process "A" @ 155,40 24x12
s2: process "B" @ 245,40 24x12
g1: process "A" @ 155,60 24x12
g2: process "B" @ 245,60 24x12
r1: process "A" @ 155,80 24x12
r2: process "B" @ 245,80 24x12
o1: process "A" @ 155,100 24x12
o2: process "B" @ 245,100 24x12
c1: process "A" @ 155,120 24x12
c2: process "B" @ 245,120 24x12

h3: text "Database (crow's foot) and custom" @ 295,8 130x8
e1: process "users" @ 295,20 24x12
e2: process "orders" @ 385,20 24x12
e3: process "person" @ 295,40 24x12
e4: process "passport" @ 385,40 24x12
e5: process "team" @ 295,60 24x12
e6: process "member" @ 385,60 24x12
x1: process "A" @ 295,80 24x12
x2: process "B" @ 385,80 24x12

f1 -> f2 : "a -> b"
d1 -data-> d2 : "a -data-> b"
m1 -msg-> m2 : "a -msg-> b"
a1 -alt-> a2 : "a -alt-> b"
w1 <-> w2 : "a <-> b"
n1 .. n2 : "a .. b"

p1 ..> p2 : "a ..> b"
s1 -- s2 : "a -- b"
g1 --|> g2 : "a --|> b"
r1 ..|> r2 : "a ..|> b"
o1 o-- o2 : "a o-- b"
c1 *-- c2 : "a *-- b"

e1 ||--o{ e2 : "a ||--o{ b"
e3 ||--o| e4 : "a ||--o| b"
e5 }o..|{ e6 : "a }o..|{ b"
x1 -- x2 [style=dashed start=circle end=fdiamond means="Escalates to, when a visit is missed"] : "a -- b [style=dashed start=circle end=fdiamond]"

key "Key: what each line means" @ 15,145
```

## patterns

Every ready-made pattern (forms, dashboard, chat, journey map, ...), as the palette adds them.

```
flow 1

# Every ready-made pattern on the palette, put in the way the Patterns buttons put them in.

page "Patterns" size 375x10218 direction LR

login: container "Log in" @ 10,10 [flow=column]
email: field "Email" [in=login]
password: password "••••••••" [in=login]
keep: checkbox "Keep me signed in" [in=login]
log_in: button "Log in" [in=login]
forgot: text "Forgot your password?" [in=login]
about: text "A login form: the one screen between a returning user and their account. Use it for any app with accounts; keep it short, say which field is wrong, and always offer a way back in." 63x26 [in=login]

signup: container "Create an account" @ 106,10 [flow=column]
full_name: field "Full name" [in=signup]
email_2: field "Email" [in=signup]
password_2: password "••••••••" [in=signup]
terms: checkbox "I agree to the terms" [in=signup]
robot: captcha "I’m not a robot" [in=signup]
sign_up: button "Sign up" [in=signup]
or: divider "or" [in=signup]
google: button "Continue with Google" [in=signup]
about_2: text "A sign-up form: creates a new account. Use it as the start of onboarding; ask for as little as you can, and offer a social sign-in for speed." 76x22 [in=signup]

settings: container "Settings" @ 10,193 [flow=row]
menu: sidebar "Account | Notifications | Privacy" [in=settings]
account: container "Account" [flow=column in=settings]
display_name: formfield "Display name | Ana Smith | Shown on your profile" [in=account]
alerts: switch "Email alerts" [state=on in=account]
dark: switch "Dark mode" [in=account]
language: dropdown "English" [in=account]
save: button "Save" [in=account]
about_3: text "A settings page: a menu of sections beside the settings in the chosen one. Use it when an app has more options than fit one screen; group them so people can find them." 60x26 [in=settings]

cookies: container "Cookies" @ 10,334 [flow=row align=center]
cookie_text: text "We use cookies to make this site work and to improve it." [in=cookies]
accept: button "Accept all" [in=cookies]
cookie_settings: button "Settings" [in=cookies]
about_4: text "A cookie banner: asks permission to use non-essential cookies. Required on many sites by law; make accepting and choosing equally easy." 60x22 [in=cookies]

results: container "Search" @ 252,334 [flow=column]
query: search "Search…" [in=results]
filters: pills "All | Images | News" [in=results]
hits: list "First result | Second result | Third result" [in=results]
pages: pagination "‹ | 1 | 2 | 3 | ›" [in=results]
about_5: text "Search results: a query, filters, the matches and paging. Use it wherever there is more content than people can browse; filters narrow the results without a new search." 64x26 [in=results]

chat: container "Ana Smith" @ 10,469 [flow=column]
msg1: chatbubble "Are we still on for 3pm?" [in=chat]
msg2: chatbubble "Yes, see you there!" [side=right in=chat]
msg3: chatbubble "Great, I’ll book a room" [in=chat]
reply: field "Write a message…" [in=chat]
about_6: text "A chat: a conversation between two people, theirs on the left and yours on the right. Use it for messaging and support; the newest message sits at the bottom, next to the box to reply in." 63x26 [in=chat]

stores: container "Find a store" @ 106,469 [flow=row]
finder: container "Near you" [flow=column in=stores]
postcode: search "Postcode or town" [in=finder]
nearby: list "Leeds, 0.4 miles | York, 22 miles | Hull, 54 miles" [in=finder]
store_map: mapview "Leeds" [in=stores]
about_7: text "A store locator: search for a place, see the nearest stores in a list beside a map. Use it for any business people visit in person." 60x22 [in=stores]

route: container "Directions" @ 10,604 [flow=row]
steps: directions "From: Leeds | To: York | Turn left onto the A64 | Turn right at the roundabout | Continue for 20 miles" [in=route]
route_map: mapview "Leeds to York" [in=route]
about_8: text "Directions: a route as a list of turns beside a map of it. Use it for travel and delivery apps; the list is easier to follow, the map easier to picture." 60x26 [in=route]

dashboard: container "Dashboard" @ 10,703 [flow=column]
nav: navbar "Brand | Overview | Reports | Settings" [in=dashboard]
kpis: container "This month" [flow=row in=dashboard]
visitors: kpi "1,204\nVisitors" [in=kpis]
conversion: kpi "3.6%\nConversion" [in=kpis]
revenue: kpi "£8.2k\nRevenue" [in=kpis]
charts: container "Trends" [flow=row in=dashboard]
sales: bar "Sales" [in=charts]
visits: line "Visits" [in=charts]
about_9: text "A dashboard: the few numbers that matter, then the trends behind them. Use it as an app's home screen or a report; the headline figures go at the top, the detail below." 142x13 [in=dashboard]

journey: container "Customer journey" @ 10,888 [flow=row gap=6]
discover: container "Discover" [flow=column align=center in=journey]
find: sticky "Finds us on search" 40x18 [in=discover]
find_mood: mood "Curious" [face=laughing in=discover]
sign_up_2: container "Sign up" [flow=column align=center in=journey]
form: sticky "Fills in a long form" 40x18 [in=sign_up_2]
form_mood: mood "Frustrated" [face=angry in=sign_up_2]
use: container "Use" [flow=column align=center in=journey]
first: sticky "First order arrives" 40x18 [in=use]
first_mood: mood "Happy" [in=use]
about_10: text "A customer journey map: the stages someone goes through, what happens at each and how they feel. Use it to find the points where people get stuck or give up." 60x26 [in=journey]

kanban: container "Board" @ 10,989 [flow=row gap=6]
todo: container "To do" [flow=column in=kanban]
doing: container "Doing" [flow=column in=kanban]
done: container "Done" [flow=column in=kanban]
brief: sticky "Write the brief" 40x18 [in=todo]
sketches: sticky "Sketch screens" 40x18 [in=todo]
login_2: sticky "Login page" 40x18 [in=doing]
setup: sticky "Project setup" 40x18 [in=done]
repo: sticky "Make the repo" 40x18 [in=done]
about_11: text "A kanban board: work as cards moving through columns. Use it to plan a team's work; anyone can see what is waiting, what is being done and what is finished." 60x26 [in=kanban]

singleton: container "Singleton" @ 10,1089 140x79
client: umlclass "Client | | + run()" @ 16,1105 34x26 [in=singleton]
only_one: umlclass "Singleton | - instance: Singleton | - Singleton()\n+ getInstance(): Singleton" @ 86,1101 58x40 [in=singleton]
client ..> only_one : "getInstance()"
about_12: text "Singleton: a class with only one instance, which everything shares. Use it for one-per-app things like a configuration, a log or a connection pool; overused, it becomes a hidden global." @ 16,1147 128x17 [in=singleton]

factory: container "Factory Method" @ 170,1089 160x125
creator: umlclass "Creator | | + factoryMethod(): Product\n+ someOperation()" @ 176,1103 64x32 [in=factory]
product: umlclass "«interface»\nProduct | | + doStuff()" @ 266,1103 58x32 [in=factory]
concrete_creator: umlclass "ConcreteCreator | | + factoryMethod(): Product" @ 176,1155 64x30 [in=factory]
concrete_product: umlclass "ConcreteProduct | | + doStuff()" @ 266,1155 58x30 [in=factory]
concrete_creator --|> creator
concrete_product ..|> product
creator ..> product : "makes"
concrete_creator ..> concrete_product : "makes"
about_13: text "Factory Method: a creator class leaves it to its subclasses to decide which product class to make. Use it when code should work with products without naming their classes, such as one document type per app." @ 176,1193 148x17 [in=factory]

observer: container "Observer" @ 10,1234 160x125
subject: umlclass "Subject | - observers: Observer[] | + attach(o)\n+ detach(o)\n+ notify()" @ 16,1246 58x44 [in=observer]
watcher: umlclass "«interface»\nObserver | | + update()" @ 106,1248 58x32 [in=observer]
concrete_subject: umlclass "ConcreteSubject | - state | + getState()" @ 16,1300 58x30 [in=observer]
concrete_watcher: umlclass "ConcreteObserver | | + update()" @ 106,1300 58x30 [in=observer]
subject o-- watcher : "notifies"
concrete_subject --|> subject
concrete_watcher ..|> watcher
concrete_watcher ..> concrete_subject : "reads state"
about_14: text "Observer: a subject keeps a list of observers and tells them all when it changes. Use it for events, UI updates and anything that must react to a change without the source knowing who is listening." @ 16,1338 148x17 [in=observer]

strategy: container "Strategy" @ 190,1234 160x121
context: umlclass "Context | - strategy: Strategy | + setStrategy(s)\n+ doWork()" @ 196,1248 58x34 [in=strategy]
plan: umlclass "«interface»\nStrategy | | + execute(data)" @ 286,1248 58x32 [in=strategy]
plan_a: umlclass "ConcreteStrategyA | | + execute(data)" @ 256,1300 44x30 [in=strategy]
plan_b: umlclass "ConcreteStrategyB | | + execute(data)" @ 302,1300 44x30 [in=strategy]
context o-- plan : "uses"
plan_a ..|> plan
plan_b ..|> plan
about_15: text "Strategy: a family of interchangeable algorithms behind one interface, picked at run time. Use it instead of a big if or switch: sorting rules, pricing, payment methods, compression." @ 196,1338 148x13 [in=strategy]

decorator: container "Decorator" @ 10,1379 160x167
component: umlclass "«interface»\nComponent | | + operation()" @ 60,1393 58x30 [in=decorator]
concrete_component: umlclass "ConcreteComponent | | + operation()" @ 16,1445 58x30 [in=decorator]
wrapper: umlclass "Decorator | - wrapped: Component | + operation()" @ 106,1445 58x32 [in=decorator]
extra: umlclass "ConcreteDecorator | | + operation()\n+ addedBehaviour()" @ 106,1493 58x30 [in=decorator]
concrete_component ..|> component
wrapper ..|> component [beginpt=n@0.25 endpt=s@0.75]
wrapper o-- component [route=elbow beginpt=n@0.75 endpt=e] : "wraps"
extra --|> wrapper
about_16: text "Decorator: wrap an object in another with the same interface to add behaviour. Use it to stack extras without a subclass for every mix, as streams add buffering or encryption." @ 16,1529 148x13 [in=decorator]

adapter: container "Adapter" @ 190,1379 160x121
client_2: umlclass "Client | | + run()" @ 196,1393 44x26 [in=adapter]
target: umlclass "«interface»\nTarget | | + request()" @ 286,1393 58x30 [in=adapter]
adaptee: umlclass "Adaptee | | + specificRequest()" @ 196,1445 58x30 [in=adapter]
fitter: umlclass "Adapter | - adaptee: Adaptee | + request()" @ 286,1445 58x32 [in=adapter]
client_2 ..> target : "calls"
fitter ..|> target
fitter o-- adaptee : "delegates to"
about_17: text "Adapter: a class that makes an existing class fit the interface a client expects. Use it to plug in third-party or old code without changing either side." @ 196,1483 148x13 [in=adapter]

abstractfactory: container "Abstract Factory" @ 10,1566 236x127
abstract_factory: umlclass "«interface»\nAbstractFactory | | + createA(): ProductA\n+ createB(): ProductB" @ 42,1578 64x38 [in=abstractfactory]
factory_1: umlclass "ConcreteFactory1 | | + createA()\n+ createB()" @ 16,1638 54x30 [in=abstractfactory]
factory_2: umlclass "ConcreteFactory2 | | + createA()\n+ createB()" @ 78,1638 54x30 [in=abstractfactory]
product_a: umlclass "«interface»\nProductA | | + use()" @ 164,1580 58x30 [in=abstractfactory]
product_a1: umlclass "ProductA1 | | + use()" @ 150,1638 42x30 [in=abstractfactory]
product_a2: umlclass "ProductA2 | | + use()" @ 198,1638 42x30 [in=abstractfactory]
factory_1 ..|> abstract_factory
factory_2 ..|> abstract_factory
product_a1 ..|> product_a
product_a2 ..|> product_a
abstract_factory ..> product_a : "makes"
about_18: text "Abstract Factory: one factory per family of related products, so the products always match each other. Use it for themes, platforms or database drivers, where mixing families would break things." @ 16,1676 224x13 [in=abstractfactory]

builder: container "Builder" @ 10,1713 160x145
director: umlclass "Director | - builder: Builder | + construct()" @ 16,1727 58x32 [in=builder]
steps_2: umlclass "«interface»\nBuilder | | + buildPartA()\n+ buildPartB()\n+ getResult()" @ 106,1725 58x42 [in=builder]
concrete_builder: umlclass "ConcreteBuilder | - product | + buildPartA()\n+ buildPartB()\n+ getResult(): Product" @ 106,1787 58x44 [in=builder]
product_2: umlclass "Product | - parts | " @ 16,1795 58x26 [in=builder]
director o-- steps_2 : "uses"
concrete_builder ..|> steps_2
concrete_builder ..> product_2 : "builds"
about_19: text "Builder: put a complex object together step by step, with the same steps able to make different results. Use it for objects with many optional parts, such as queries, documents or HTTP requests." @ 16,1837 148x17 [in=builder]

prototype: container "Prototype" @ 190,1713 160x125
client_3: umlclass "Client | | + operation()" @ 196,1729 44x26 [in=prototype]
cloneable: umlclass "«interface»\nPrototype | | + clone(): Prototype" @ 286,1727 58x30 [in=prototype]
proto_1: umlclass "ConcretePrototype1 | - field | + clone()" @ 254,1781 44x34 [in=prototype]
proto_2: umlclass "ConcretePrototype2 | - field | + clone()" @ 302,1781 44x34 [in=prototype]
client_3 ..> cloneable : "clone()"
proto_1 ..|> cloneable
proto_2 ..|> cloneable
about_20: text "Prototype: make new objects by copying an existing one. Use it when building from scratch is costly or complicated, or to copy objects without knowing their class." @ 196,1821 148x13 [in=prototype]

facade: container "Facade" @ 10,1878 202x127
client_4: umlclass "Client | | + run()" @ 16,1894 40x26 [in=facade]
front: umlclass "Facade | | + doTask()" @ 108,1892 50x26 [in=facade]
subsystem: container "Subsystem" @ 60,1934 146x48 [in=facade bgfill=#F4F6F8]
part_a: umlclass "ClassA | | + stepA()" @ 66,1946 42x30 [in=subsystem]
part_b: umlclass "ClassB | | + stepB()" @ 112,1946 42x30 [in=subsystem]
part_c: umlclass "ClassC | | + stepC()" @ 158,1946 42x30 [in=subsystem]
client_4 ..> front : "calls"
front ..> part_a
front ..> part_b
front ..> part_c
about_21: text "Facade: one simple class in front of a complicated subsystem. Use it to give the common tasks an easy door, while the subsystem stays there for anyone who needs more." @ 16,1988 190x13 [in=facade]

composite: container "Composite" @ 10,2025 160x131
component_2: umlclass "«interface»\nComponent | | + operation()" @ 60,2039 58x30 [in=composite]
leaf: umlclass "Leaf | | + operation()" @ 16,2091 58x30 [in=composite]
branch: umlclass "Composite | - children: Component[] | + operation()\n+ add(c)\n+ remove(c)" @ 106,2087 58x46 [in=composite]
leaf ..|> component_2
branch ..|> component_2 [beginpt=n@0.25 endpt=s@0.75]
branch o-- component_2 [route=elbow beginpt=n@0.75 endpt=e] : "children"
about_22: text "Composite: build trees of objects and treat a group exactly like a single item. Use it for files and folders, shapes in a drawing, menus within menus." @ 16,2139 148x13 [in=composite]

proxy: container "Proxy" @ 190,2025 162x131
client_5: umlclass "Client | | + run()" @ 196,2041 40x26 [in=proxy]
subject_2: umlclass "«interface»\nSubject | | + request()" @ 286,2039 58x30 [in=proxy]
real: umlclass "RealSubject | | + request()" @ 234,2097 44x30 [in=proxy]
stand_in: umlclass "Proxy | - real: RealSubject | + request()" @ 300,2093 46x36 [in=proxy]
client_5 ..> subject_2 : "calls"
real ..|> subject_2
stand_in ..|> subject_2
stand_in ..> real : "forwards"
about_23: text "Proxy: a stand-in with the same interface as the real object, which controls access to it. Use it to load something only when needed, check permissions, cache, or talk to a remote object." @ 196,2135 150x17 [in=proxy]

command: container "Command" @ 10,2176 160x129
invoker: umlclass "Invoker | - command: Command | + run()" @ 16,2190 58x32 [in=command]
order: umlclass "«interface»\nCommand | | + execute()" @ 106,2190 58x30 [in=command]
concrete_command: umlclass "ConcreteCommand | - receiver | + execute()" @ 106,2248 58x32 [in=command]
receiver: umlclass "Receiver | | + action()" @ 16,2250 58x28 [in=command]
invoker o-- order : "holds"
concrete_command ..|> order
concrete_command ..> receiver : "calls action()"
about_24: text "Command: turn a request into an object. Use it to queue, log, schedule or undo actions, as an editor's undo stack or a job queue does." @ 16,2288 148x13 [in=command]

state: container "State" @ 190,2176 160x129
context_2: umlclass "Context | - state: State | + request()" @ 196,2190 58x32 [in=state]
current: umlclass "«interface»\nState | | + handle(context)" @ 286,2190 58x30 [in=state]
state_a: umlclass "ConcreteStateA | | + handle(context)" @ 254,2246 44x32 [in=state]
state_b: umlclass "ConcreteStateB | | + handle(context)" @ 302,2246 44x32 [in=state]
context_2 o-- current : "current"
state_a ..|> current
state_b ..|> current
about_25: text "State: an object changes its behaviour when its state changes, by handing work to a state object. Use it instead of state checks in every method: orders, connections, game characters, media players." @ 196,2284 148x17 [in=state]

template: container "Template Method" @ 10,2325 160x133
abstract: umlclass "AbstractClass | | + templateMethod()\n# step1()\n# step2()" @ 54,2337 70x40 [in=template]
concrete_a: umlclass "ConcreteClassA | | # step1()\n# step2()" @ 16,2399 64x30 [in=template]
concrete_b: umlclass "ConcreteClassB | | # step1()\n# step2()" @ 100,2399 64x30 [in=template]
concrete_a --|> abstract
concrete_b --|> abstract
about_26: text "Template Method: a base class fixes the outline of an algorithm and leaves some steps to subclasses. Use it when several classes share the same overall process but differ in a few steps." @ 16,2437 148x17 [in=template]

iterator: container "Iterator" @ 190,2325 160x131
collection: umlclass "«interface»\nAggregate | | + createIterator(): Iterator" @ 196,2339 64x30 [in=iterator]
cursor: umlclass "«interface»\nIterator | | + hasNext(): bool\n+ next(): Item" @ 286,2337 58x36 [in=iterator]
concrete_collection: umlclass "ConcreteAggregate | - items | + createIterator()" @ 196,2397 64x34 [in=iterator]
concrete_cursor: umlclass "ConcreteIterator | - index | + hasNext()\n+ next()" @ 286,2395 58x38 [in=iterator]
concrete_collection ..|> collection
concrete_cursor ..|> cursor
concrete_collection ..> concrete_cursor : "creates"
about_27: text "Iterator: step through a collection without knowing how it is stored. Use it so the same loop works on lists, trees and streams; it's what for-each loops are built on." @ 196,2439 148x13 [in=iterator]

chain: container "Chain of Responsibility" @ 10,2478 160x141
client_6: umlclass "Client | | + send(request)" @ 16,2494 44x26 [in=chain]
handler: umlclass "Handler | - next: Handler | + handle(request)\n+ setNext(h)" @ 106,2490 58x38 [in=chain]
handler_a: umlclass "HandlerA | | + handle(request)" @ 74,2550 44x30 [in=chain]
handler_b: umlclass "HandlerB | | + handle(request)" @ 122,2550 44x30 [in=chain]
passing: text "A request goes along the chain, A then B then the next, until one handles it." @ 16,2586 148x10 [in=chain]
client_6 ..> handler : "handle()"
handler_a --|> handler
handler_b --|> handler
about_28: text "Chain of Responsibility: pass a request along a chain of handlers until one deals with it. Use it for middleware, event bubbling, support tiers and approval rules." @ 16,2602 148x13 [in=chain]

visitor: container "Visitor" @ 190,2478 160x135
element: umlclass "«interface»\nElement | | + accept(v: Visitor)" @ 196,2492 58x30 [in=visitor]
guest: umlclass "«interface»\nVisitor | | + visitA(a)\n+ visitB(b)" @ 286,2490 58x36 [in=visitor]
element_a: umlclass "ElementA | | + accept(v)" @ 196,2552 40x30 [in=visitor]
element_b: umlclass "ElementB | | + accept(v)" @ 240,2552 40x30 [in=visitor]
concrete_visitor: umlclass "ConcreteVisitor | | + visitA(a)\n+ visitB(b)" @ 286,2550 58x34 [in=visitor]
element ..> guest : "accepts"
element_a ..|> element
element_b ..|> element
concrete_visitor ..|> guest
about_29: text "Visitor: add new operations to a set of classes without changing them, by putting each operation in a visitor. Use it for compilers and document exporters: many operations over a fixed set of node types." @ 196,2592 148x17 [in=visitor]

injection: container "Dependency Injection" @ 10,2639 160x133
injector: umlclass "Injector | | + build(): Client" @ 16,2653 52x26 [in=injection]
client_7: umlclass "Client | - service: Service | + Client(service)" @ 106,2651 58x32 [in=injection]
service: umlclass "«interface»\nService | | + doWork()" @ 106,2713 58x30 [in=injection]
email_3: umlclass "EmailService | | + doWork()" @ 16,2713 52x30 [in=injection]
client_7 o-- service : "needs a"
email_3 ..|> service
injector ..> client_7 : "creates, passing in"
injector ..> email_3 : "creates"
about_30: text "Dependency Injection: a class is given the things it needs instead of making them. Use it to swap real services for test ones and keep classes loosely joined; frameworks often do the wiring." @ 16,2751 148x17 [in=injection]

flyweight: container "Flyweight" @ 190,2639 170x129
factory_3: umlclass "FlyweightFactory | - pool: Map | + get(key): Flyweight" @ 196,2653 64x32 [in=flyweight]
shared: umlclass "«interface»\nFlyweight | | + draw(extrinsic)" @ 290,2653 64x30 [in=flyweight]
client_8: umlclass "Client | - extrinsic state | + render()" @ 196,2711 64x32 [in=flyweight]
concrete: umlclass "ConcreteFlyweight | - intrinsic state | + draw(extrinsic)" @ 290,2709 64x34 [in=flyweight]
factory_3 o-- shared : "shares"
concrete ..|> shared
client_8 ..> factory_3 : "get(key)"
about_31: text "Flyweight: share one object between many uses, passing in the parts that differ. Use it when there are huge numbers of similar objects, like characters in a document or trees in a game." @ 196,2751 158x13 [in=flyweight]

mediator: container "Mediator" @ 10,2792 174x129
hub: umlclass "«interface»\nMediator | | + notify(sender, event)" @ 16,2806 64x30 [in=mediator]
concrete_hub: umlclass "ConcreteMediator | - a, b | + notify(sender, event)" @ 16,2862 64x34 [in=mediator]
colleague: umlclass "Colleague | - mediator | + changed()" @ 114,2806 64x32 [in=mediator]
colleague_a: umlclass "ColleagueA | | " @ 106,2866 36x26 [in=mediator]
colleague_b: umlclass "ColleagueB | | " @ 144,2866 36x26 [in=mediator]
concrete_hub ..|> hub
colleague o-- hub : "talks through"
colleague_a --|> colleague
colleague_b --|> colleague
concrete_hub ..> colleague_a : "coordinates"
about_32: text "Mediator: objects talk through one hub instead of to each other. Use it to untangle many-to-many links: form fields that affect each other, chat rooms, air traffic control." @ 16,2904 162x13 [in=mediator]

memento: container "Memento" @ 10,2941 170x125
originator: umlclass "Originator | - state | + save(): Memento\n+ restore(m)" @ 16,2955 58x36 [in=memento]
snapshot: umlclass "Memento | - state | + getState()" @ 114,2955 58x32 [in=memento]
caretaker: umlclass "Caretaker | - history: Memento[] | + undo()" @ 114,3011 58x32 [in=memento]
originator ..> snapshot : "creates"
caretaker o-- snapshot : "keeps"
caretaker ..> originator : "restore()"
about_33: text "Memento: save an object's state so it can be put back later, without exposing its insides. Use it for undo, checkpoints and drafts." @ 16,3049 158x13 [in=memento]

bridge: container "Bridge" @ 10,3086 182x125
abstraction: umlclass "Abstraction | - impl: Implementor | + operation()" @ 16,3100 64x32 [in=bridge]
refined: umlclass "RefinedAbstraction | | + operation()" @ 16,3158 64x28 [in=bridge]
implementor: umlclass "«interface»\nImplementor | | + operationImpl()" @ 118,3100 64x30 [in=bridge]
impl_a: umlclass "ImplementorA | | + operationImpl()" @ 102,3158 42x28 [in=bridge]
impl_b: umlclass "ImplementorB | | + operationImpl()" @ 146,3158 42x28 [in=bridge]
abstraction o-- implementor : "bridge"
refined --|> abstraction
impl_a ..|> implementor
impl_b ..|> implementor
about_34: text "Bridge: separate what something is from how it's done, so both can vary on their own. Use it to avoid a class for every combination, such as shapes times renderers or remotes times devices." @ 16,3194 170x13 [in=bridge]

interpreter: container "Interpreter" @ 10,3231 184x129
context_3: umlclass "Context | - variables | " @ 16,3245 50x26 [in=interpreter]
expression: umlclass "«interface»\nExpression | | + interpret(ctx)" @ 100,3243 64x30 [in=interpreter]
number: umlclass "NumberExpr | - value | + interpret(ctx)" @ 74,3303 50x32 [in=interpreter]
add: umlclass "AddExpr | - left, right | + interpret(ctx)" @ 130,3303 50x32 [in=interpreter]
example: text "1 + 2 becomes\nAddExpr(NumberExpr 1,\nNumberExpr 2)" @ 16,3291 52x24 [in=interpreter]
expression ..> context_3 : "reads"
number ..|> expression
add ..|> expression
add o-- expression [route=elbow beginpt=e endpt=e] : "operands"
about_35: text "Interpreter: a small language's grammar as classes, each knowing how to evaluate itself. Use it for simple rule languages, filters and calculators; bigger languages want a parser generator." @ 16,3343 172x13 [in=interpreter]

nullobject: container "Null object" @ 10,3380 170x121
client_9: umlclass "Client | - log: Logger | + run()" @ 16,3394 52x32 [in=nullobject]
logger: umlclass "«interface»\nLogger | | + log(msg)" @ 110,3394 58x30 [in=nullobject]
file_logger: umlclass "FileLogger | | + log(msg): writes it" @ 76,3446 48x30 [in=nullobject]
null_logger: umlclass "NullLogger | | + log(msg): does nothing" @ 126,3446 48x30 [in=nullobject]
client_9 o-- logger : "never null"
file_logger ..|> logger
null_logger ..|> logger
about_36: text "Null object: instead of null, use an object with the same interface that does nothing. Callers never need \"if not null\" checks. Used for optional loggers, listeners and default behaviour." @ 16,3484 158x13 [in=nullobject]

objectpool: container "Object pool" @ 200,3380 146x133
client_10: umlclass "Client | | + work()" @ 206,3394 36x28 [in=objectpool]
pool: umlclass "ConnectionPool | - free: Connection[]\n- inUse: Connection[] | + acquire(): Connection\n+ release(c)" @ 272,3394 68x42 [in=objectpool]
connection: umlclass "Connection | - socket | + query(sql)\n+ reset()" @ 272,3456 68x34 [in=objectpool]
client_10 ..> pool : "acquire, release"
pool o-- connection : "keeps 10"
about_37: text "Object pool: keep a set of costly objects ready and lend them out, instead of making a new one each time. Used for database connections, threads and game objects." @ 206,3496 134x13 [in=objectpool]

layered: container "Layered architecture" @ 10,3533 140x157
presentation: process "Presentation\nscreens, API endpoints" @ 30,3545 100x16 [in=layered]
application: process "Application\nuse cases, services" @ 30,3569 100x16 [in=layered]
domain: process "Domain\nbusiness rules" @ 30,3593 100x16 [in=layered]
data: process "Data access\nrepositories" @ 30,3617 100x16 [in=layered]
store: database "Database" @ 65,3639 30x24 [in=layered]
presentation -> application : "calls"
application -> domain : "calls"
domain -> data : "calls"
data -data-> store
about_38: text "Layered architecture: code split into layers, each only calling the one below. Use it for most business apps; a change in one layer stays there, and each layer can be tested on its own." @ 16,3669 128x17 [in=layered]

pubsub: container "Publish / subscribe" @ 170,3533 170x95
orders: api "Orders service" @ 176,3549 52x16 [in=pubsub]
payments: api "Payments service" @ 176,3581 52x16 [in=pubsub]
bus: queue "Event bus" @ 252,3568 [in=pubsub]
email_4: api "Email" @ 294,3545 40x14 [in=pubsub]
analytics: api "Analytics" @ 294,3567 40x14 [in=pubsub]
warehouse: api "Warehouse" @ 294,3589 40x14 [in=pubsub]
orders -data-> bus : "publish"
payments -data-> bus : "publish"
bus -data-> email_4
bus -data-> analytics : "deliver"
bus -data-> warehouse
about_39: text "Publish / subscribe: services post events to a bus, and every service that subscribed gets a copy. Use it to keep services independent: publishers never know who is listening." @ 176,3611 158x13 [in=pubsub]

cqrs: container "CQRS" @ 10,3710 160x113
client_11: user "Client" @ 16,3746 15x20 [in=cqrs]
commands: api "Command side\nvalidates and writes" @ 46,3724 62x18 [in=cqrs]
write_store: database "Write store" @ 130,3720 32x26 [in=cqrs]
queries: api "Query side\nreads only" @ 46,3772 62x18 [in=cqrs]
read_store: database "Read store" @ 130,3768 32x26 [in=cqrs]
client_11 -> commands : "commands"
client_11 -> queries : "queries"
commands -data-> write_store
read_store -data-> queries : "results"
write_store -data-> read_store : "events"
about_40: text "CQRS: commands (writes) and queries (reads) take separate paths, with separate models and often separate stores. Use it when reads and writes have very different needs or loads." @ 16,3806 148x13 [in=cqrs]

microservices: container "Microservices with an API gateway" @ 10,3843 176x117
client_12: user "Client" @ 16,3883 15x20 [in=microservices]
gateway: api "API gateway" @ 42,3884 40x18 [in=microservices]
users: service "Users" @ 110,3857 [in=microservices]
orders_2: service "Orders" @ 110,3886 [in=microservices]
payments_2: service "Payments" @ 110,3915 [in=microservices]
users_db: database "Users" @ 146,3853 28x22 [in=microservices]
orders_db: database "Orders" @ 146,3882 28x22 [in=microservices]
payments_db: database "Payments" @ 146,3911 28x22 [in=microservices]
client_12 -> gateway
gateway -> users
gateway -> orders_2
gateway -> payments_2
users -data-> users_db
orders_2 -data-> orders_db
payments_2 -data-> payments_db
about_41: text "Microservices: a system as small services, each owning its data, behind a gateway. Use it when teams need to build, deploy and scale parts on their own; it adds network and data problems in return." @ 16,3943 164x13 [in=microservices]

webapp: container "Web app architecture" @ 10,3980 170x105
people: user "Users" @ 16,4014 15x20 [in=webapp]
balancer: loadbalancer "Load balancer" @ 44,4017 [in=webapp]
web_1: server "Web 1" @ 88,3992 15x25 [in=webapp]
web_2: server "Web 2" @ 88,4032 15x25 [in=webapp]
store_2: database "Database" @ 138,3990 30x26 [in=webapp]
hot: cache "Cache" @ 145,4036 [in=webapp]
people -> balancer
balancer -> web_1
balancer -> web_2
web_1 -data-> store_2
web_2 -data-> store_2
web_1 -data-> hot
web_2 -data-> hot
about_42: text "A web app's architecture: a load balancer spreads users over several web servers, which share a database and a cache. Use it as the starting shape for any site that has to stay up and grow." @ 16,4068 158x13 [in=webapp]

breaker: container "Circuit breaker" @ 10,4105 180x107
start: initial @ 18,4129 [in=breaker]
closed: state "Closed\ncalls go through" @ 34,4123 44x20 [in=breaker fill=#D9EAD3]
open: state "Open\ncalls fail fast" @ 138,4123 44x20 [in=breaker fill=#F4CCCC]
half_open: state "Half-open\none trial call" @ 86,4167 44x20 [in=breaker fill=#FCE5CD]
start -> closed
closed -> open : "too many failures"
open -> half_open [route=elbow beginpt=s@0.3 endpt=e@0.3] : "after a timeout"
half_open -> open [route=elbow beginpt=e@0.7 endpt=s@0.7] : "trial fails"
half_open -> closed [route=elbow beginpt=w endpt=s] : "trial succeeds"
about_43: text "Circuit breaker: stop calling a service that keeps failing, then try again carefully. Use it around calls to other services so one failure doesn't spread through the whole system." @ 16,4195 168x13 [in=breaker]

unitofwork: container "Unit of Work" @ 10,4232 174x125
service_2: umlclass "OrderService | | + checkout()" @ 16,4246 50x26 [in=unitofwork]
work: umlclass "UnitOfWork | - changes | + registerNew(x)\n+ registerDirty(x)\n+ commit()" @ 110,4242 64x42 [in=unitofwork]
orders_3: umlclass "OrderRepository | | + add(order)" @ 74,4304 50x28 [in=unitofwork]
stock: umlclass "StockRepository | | + update(item)" @ 128,4304 50x28 [in=unitofwork]
store_3: database "Database" @ 22,4304 30x26 [in=unitofwork]
service_2 ..> work : "commit()"
work o-- orders_3
work o-- stock
work -data-> store_3 : "one transaction"
about_44: text "Unit of Work: collect every change made during a task, then save them all in one transaction. Use it with repositories so a task either saves completely or not at all." @ 16,4340 162x13 [in=unitofwork]

mvc: container "Model–View–Controller" @ 10,4377 190x75
person: user "User" @ 16,4399 14x22 [in=mvc]
controller: process "Controller\nhandles input" @ 42,4401 40x18 [in=mvc]
model: process "Model\ndata and rules" @ 98,4401 40x18 [in=mvc]
view: process "View\nshows the model" @ 154,4401 40x18 [in=mvc]
person -> controller : "acts"
controller -> model : "updates"
model -data-> view : "notifies"
view -> person [route=elbow beginpt=n endpt=n] : "sees"
about_45: text "Model–View–Controller: input, data and display kept apart. Use it for user interfaces, so the same data can have several views and the rules can be tested without a screen." @ 16,4435 178x13 [in=mvc]

repository: container "Repository" @ 10,4472 164x133
service_3: umlclass "OrderService | | + placeOrder()" @ 16,4488 52x26 [in=repository]
orders_4: umlclass "«interface»\nOrderRepository | | + find(id)\n+ save(order)" @ 100,4484 68x36 [in=repository]
sql_orders: umlclass "SqlOrderRepository | - db | + find(id)\n+ save(order)" @ 100,4544 68x36 [in=repository]
store_4: database "Database" @ 26,4546 34x30 [in=repository]
service_3 ..> orders_4 : "uses"
sql_orders ..|> orders_4
sql_orders -data-> store_4 : "SQL"
about_46: text "Repository: the rest of the code asks a collection-like interface for its data, never the database. Use it to keep queries in one place and to test with an in-memory version." @ 16,4588 152x13 [in=repository]

request: container "Client–server request" @ 194,4472 140x105
browser: lifeline "Browser" @ 202,4484 32x66 [in=request]
web: lifeline "Web server" 32x66 [in=request]
store_5: lifeline "Database" 32x66 [in=request]
browser -> web : "GET /orders"
web -> store_5 : "SELECT"
store_5 ..> web : "rows"
web ..> browser : "200 OK + JSON"
about_47: text "A client–server request: the browser asks a web server, which asks its database, and the answer comes back the same way. Use it to explain or design one request through a system." @ 200,4556 128x17 [in=request]

handshake: container "TCP three-way handshake" @ 10,4625 96x110
client_13: lifeline "Client" @ 18,4637 30x66 [in=handshake]
server: lifeline "Server" 30x66 [in=handshake]
client_13 -> server : "SYN"
server ..> client_13 : "SYN-ACK"
client_13 -> server : "ACK"
client_13 -> server : "data"
about_48: text "The TCP three-way handshake: how two machines open a reliable connection before sending any data. It happens under every HTTP request, so it is why new connections cost a round trip." @ 16,4709 84x22 [in=handshake]

oauth: container "OAuth sign-in (authorisation code)" @ 126,4625 164x145
browser_2: lifeline "Browser" @ 134,4637 38x106 [in=oauth]
app: lifeline "App" 38x106 [in=oauth]
auth: lifeline "Auth server" 38x106 [in=oauth]
browser_2 -> app : "Log in"
app ..> browser_2 : "go to the auth server"
browser_2 -> auth : "sign in, approve"
auth ..> browser_2 : "back to the app with a code"
browser_2 -> app : "the code"
app -> auth : "swap code for a token"
auth ..> app : "access token"
app ..> browser_2 : "signed in"
about_49: text "OAuth sign-in with an authorisation code: the app never sees the user's password, only a token from the auth server. Use it for \"Sign in with ...\" buttons and for apps acting on a user's behalf." @ 132,4749 152x17 [in=oauth]

eventsourcing: container "Event sourcing" @ 10,4790 182x117
command_2: process "Command:\ndeposit £50" @ 16,4806 40x16 [in=eventsourcing]
account_2: api "Account service" @ 68,4806 46x16 [in=eventsourcing]
store_label: text "Event store: append only" @ 128,4798 58x8 [in=eventsourcing]
e1: process "1  Opened" @ 128,4806 58x10 [in=eventsourcing fill=#FDE7C8]
e2: process "2  Deposited £100" @ 128,4818 58x10 [in=eventsourcing fill=#FDE7C8]
e3: process "3  Withdrew £30" @ 128,4830 58x10 [in=eventsourcing fill=#FDE7C8]
e4: process "4  Deposited £50" @ 128,4842 58x10 [in=eventsourcing fill=#FDE7C8]
projection: process "Projection: replay\nthe events in order" @ 128,4862 58x16 [in=eventsourcing]
balance: database "Read model:\nbalance £120" @ 68,4856 46x24 [in=eventsourcing]
command_2 -> account_2
account_2 -data-> e4 : "append"
e4 -> projection : "replay"
projection -data-> balance
about_50: text "Event sourcing: store every change as an event in an append-only log, never overwriting, and work out the current state by replaying the events. Gives a full history and audit trail. Used in banking, ordering and with CQRS." @ 16,4886 170x17 [in=eventsourcing]

saga: container "Saga: booking a trip" @ 10,4927 222x93
start_2: terminator "Book a trip" @ 16,4943 34x14 [in=saga]
flight: process "Book flight" @ 58,4943 34x14 [in=saga]
hotel: process "Book hotel" @ 100,4943 34x14 [in=saga]
pay: decision "Card charged?" @ 142,4939 36x22 [in=saga]
done_2: terminator "Trip booked" @ 192,4943 34x14 [in=saga fill=#D9EAD3]
cancel_hotel: process "Cancel hotel" @ 100,4979 34x14 [in=saga fill=#F4CCCC]
cancel_flight: process "Cancel flight" @ 58,4979 34x14 [in=saga fill=#F4CCCC]
failed: terminator "Trip cancelled" @ 16,4979 34x14 [in=saga]
start_2 -> flight
flight -> hotel
hotel -> pay
pay -> done_2 : "yes"
pay -> cancel_hotel [route=elbow beginpt=s endpt=e] : "no"
cancel_hotel -> cancel_flight
cancel_flight -> failed
about_51: text "Saga: a long task split into local steps across services, each with a compensating step that undoes it. If a later step fails, the ones already done are undone in reverse. Used where one database transaction can't span the services." @ 16,5003 210x13 [in=saga]

strangler: container "Strangler fig" @ 10,5040 170x109
client_14: user "Client" @ 16,5072 15x20 [in=strangler]
facade_2: api "Routing facade" @ 42,5074 42x16 [in=strangler]
legacy: process "Legacy monolith\nreports (not moved yet)" @ 112,5052 62x20 [in=strangler fill=#EFEFEF]
new_orders: process "New orders service" @ 112,5082 62x14 [in=strangler fill=#D9EAD3]
new_billing: process "New billing service" @ 112,5104 62x14 [in=strangler fill=#D9EAD3]
client_14 -> facade_2
facade_2 -> legacy : "/reports"
facade_2 -> new_orders : "/orders"
facade_2 -> new_billing : "/billing"
about_52: text "Strangler fig: replace an old system bit by bit. A facade sends each call to the old system or to its new replacement, and features move over one at a time until the old system can be switched off. Used for safe rewrites." @ 16,5128 158x17 [in=strangler]

retry: container "Retry with backoff" @ 10,5169 164x117
start_3: initial @ 18,5193 [in=retry]
call: state "Call the\nservice" @ 34,5187 44x20 [in=retry]
wait: state "Wait 1 s, 2 s, 4 s ...\ndoubling, plus jitter" @ 34,5235 44x20 [in=retry fill=#FCE5CD]
done_3: state "Done" @ 124,5179 44x16 [in=retry fill=#D9EAD3]
give_up: state "Give up:\nreport the error" @ 124,5213 44x20 [in=retry fill=#F4CCCC]
start_3 -> call
call -> done_3 : "succeeds"
call -> wait [route=elbow beginpt=s@0.3 endpt=n@0.3] : "fails, tries left"
wait -> call [route=elbow beginpt=n@0.7 endpt=s@0.7] : "timer"
call -> give_up : "fails, none left"
about_53: text "Retry with backoff: when a call fails, wait and try again, doubling the wait each time and adding a little randomness (jitter), up to a limit. Used for network calls and cloud APIs that fail now and then." @ 16,5265 152x17 [in=retry]

limiter: container "Rate limiter: token bucket" @ 10,5306 168x127
request_2: terminator "A request" @ 16,5322 40x14 [in=limiter]
check: decision "A token in\nthe bucket?" @ 66,5316 44x26 [in=limiter]
serve: process "Take a token,\nhandle it" @ 128,5322 44x16 [in=limiter fill=#D9EAD3]
reject: process "429 Too Many\nRequests" @ 66,5358 44x16 [in=limiter fill=#F4CCCC]
bucket: database "Bucket:\n7 of 10 tokens" @ 128,5352 44x24 [in=limiter]
refill: process "Refill: 1 token\nevery 100 ms" @ 128,5388 44x16 [in=limiter]
request_2 -> check
check -> serve : "yes"
check -> reject : "no"
refill -> bucket
bucket ..> check : "tokens"
about_54: text "Rate limiter (token bucket): every request takes a token from a bucket that refills at a steady rate. Short bursts are fine, a flood is turned away. Used by APIs to stop one client overloading them." @ 16,5412 156x17 [in=limiter]

webhook: container "Webhook" @ 10,5453 164x121
app_2: lifeline "Your app" @ 18,5465 38x82 [in=webhook]
provider: lifeline "Payment provider" 38x82 [in=webhook]
customer: lifeline "Customer" 38x82 [in=webhook]
app_2 -> provider : "register /hooks URL"
customer -> provider : "pays"
provider -> app_2 : "POST /hooks: paid"
app_2 ..> provider : "200 OK"
app_2 -> customer : "order confirmed"
about_55: text "Webhook: instead of asking another service again and again whether something has happened, give it a URL and it calls you when it does. Used for payments, Git pushes, form sign-ups and chat bots." @ 16,5553 152x17 [in=webhook]

refresh: container "Token refresh" @ 194,5453 164x131
app_3: lifeline "App" @ 202,5465 38x92 [in=refresh]
api: lifeline "API" 38x92 [in=refresh]
auth_2: lifeline "Auth server" 38x92 [in=refresh]
app_3 -> api : "GET /orders + token"
api ..> app_3 : "401: token expired"
app_3 -> auth_2 : "refresh token"
auth_2 ..> app_3 : "new access token"
app_3 -> api : "GET /orders again"
api ..> app_3 : "200 OK"
about_56: text "Token refresh: access tokens are short-lived for safety. When one expires, the app swaps its long-lived refresh token for a new access token and retries, without asking the user to sign in again." @ 200,5563 152x17 [in=refresh]

checkout: container "Checkout" @ 10,5604 196x127
browser_3: lifeline "Browser" @ 18,5616 36x92 [in=checkout]
shop: lifeline "Shop" 36x92 [in=checkout]
payments_3: lifeline "Payments" 36x92 [in=checkout]
warehouse_2: lifeline "Warehouse" 36x92 [in=checkout]
browser_3 -> shop : "place order"
shop -> payments_3 : "charge £40"
payments_3 ..> shop : "paid"
shop -> warehouse_2 : "reserve items"
warehouse_2 ..> shop : "reserved"
shop ..> browser_3 : "order confirmed"
about_57: text "Checkout: one order touching several services. The shop takes payment, then has the warehouse reserve the items, before confirming. Used to show who calls whom, and where a failure would need handling." @ 16,5714 184x13 [in=checkout]

bsearch: container "Binary search" @ 10,5751 190x213
start_4: terminator "Sorted list, target" @ 74,5763 48x14 [in=bsearch]
init: process "low = 0\nhigh = n − 1" @ 74,5785 48x16 [in=bsearch]
more: decision "low ≤ high?" @ 74,5809 48x20 [in=bsearch]
mid: process "mid = (low + high) ÷ 2" @ 74,5837 48x16 [in=bsearch]
hit: decision "list[mid] = target?" @ 74,5861 48x20 [in=bsearch]
lower: decision "list[mid] < target?" @ 74,5891 48x20 [in=bsearch]
right_half: process "low = mid + 1" @ 146,5893 44x16 [in=bsearch]
left_half: process "high = mid − 1" @ 74,5921 48x16 [in=bsearch]
found: terminator "Found at mid" @ 16,5864 44x14 [in=bsearch]
missing: terminator "Not found" @ 16,5812 40x14 [in=bsearch]
start_4 -> init
init -> more
more -> mid : "yes"
more -alt-> missing : "no"
mid -> hit
hit -> found : "yes"
hit -> lower : "no"
lower -> right_half : "yes"
lower -> left_half : "no"
right_half -> more [route=elbow beginpt=n endpt=e]
left_half -> more [route=elbow beginpt=e endpt=e]
about_58: text "Binary search: find an item in a sorted list by checking the middle and throwing away the half it can't be in. Takes about log2(n) checks, so a million items need about 20. Use it on any sorted data." @ 16,5947 178x13 [in=bsearch]

bubble: container "Bubble sort" @ 10,5984 190x223
start_5: terminator "List of n items" @ 74,5996 48x14 [in=bubble]
pass: process "swapped = false\nj = 0" @ 74,6018 48x16 [in=bubble]
more_2: decision "j < n − 1?" @ 74,6042 48x20 [in=bubble]
compare: decision "list[j] > list[j + 1]?" @ 74,6072 48x22 [in=bubble]
swap: process "swap them\nswapped = true" @ 146,6075 44x16 [in=bubble]
step: process "j = j + 1" @ 74,6104 48x14 [in=bubble]
again: decision "swapped?" @ 16,6134 44x20 [in=bubble]
done_4: terminator "Sorted" @ 16,6166 44x14 [in=bubble]
start_5 -> pass
pass -> more_2
more_2 -> compare : "yes"
more_2 -> again [route=elbow] : "no"
compare -> swap : "yes"
compare -> step : "no"
swap -> step [route=elbow beginpt=s endpt=e@0.3]
step -> more_2 [route=elbow beginpt=e@0.7 endpt=e]
again -> pass [route=elbow beginpt=n endpt=w] : "yes"
again -> done_4 : "no"
about_59: text "Bubble sort: walk the list swapping neighbours that are out of order, until a whole pass swaps nothing. Simple but slow (n² comparisons), so it is used for teaching and tiny lists only." @ 16,6190 178x13 [in=bubble]

bst: container "Binary search tree: finding 7" @ 10,6227 150x113
n8: ellipse "8" @ 78,6239 14x14 [in=bst fill=#FDE7C8]
n3: ellipse "3" @ 46,6261 14x14 [in=bst fill=#FDE7C8]
n10: ellipse "10" @ 110,6261 14x14 [in=bst]
n1: ellipse "1" @ 28,6283 14x14 [in=bst]
n6: ellipse "6" @ 64,6283 14x14 [in=bst fill=#FDE7C8]
n14: ellipse "14" @ 128,6283 14x14 [in=bst]
n4: ellipse "4" @ 52,6303 12x12 [in=bst]
n7: ellipse "7" @ 76,6303 12x12 [in=bst fill=#F6B26B]
n8 -> n3 : "7 < 8"
n8 -> n10
n3 -> n1
n3 -> n6 : "7 > 3"
n10 -> n14
n6 -> n4
n6 -> n7 : "7 > 6"
about_60: text "Binary search tree: each node's left side holds smaller values and its right side bigger ones. Search, insert and delete take about log2(n) steps while the tree stays balanced. Used in maps, sets and database indexes." @ 16,6319 138x17 [in=bst]

linked: container "Linked list" @ 180,6227 176x61
head: text "head" @ 184,6243 14x8 [in=linked]
val_a: process "12" @ 202,6241 16x12 [in=linked]
next_a: process "next" @ 218,6241 14x12 [in=linked fill=#E8EDF2]
val_b: process "99" @ 244,6241 16x12 [in=linked]
next_b: process "next" @ 260,6241 14x12 [in=linked fill=#E8EDF2]
val_c: process "37" @ 286,6241 16x12 [in=linked]
next_c: process "next" @ 302,6241 14x12 [in=linked fill=#E8EDF2]
tail: text "null" @ 330,6243 18x8 [in=linked]
head -> val_a
next_a -> val_b
next_b -> val_c
next_c -> tail
about_61: text "Linked list: each node holds a value and a pointer to the next node. Adding or removing at a known place is quick, but finding the nth item means walking from the start. Used for queues, undo history and free lists." @ 186,6267 164x17 [in=linked]

stack: container "Stack: last in, first out" @ 10,6360 100x101
push: text "push ↓   pop ↑" @ 32,6372 56x8 [in=stack]
top: process "7  ← top" @ 32,6382 56x12 [in=stack fill=#FDE7C8]
second: process "3" @ 32,6396 56x12 [in=stack]
third: process "9" @ 32,6410 56x12 [in=stack]
bottom: process "4" @ 32,6424 56x12 [in=stack]
about_62: text "Stack: last in, first out. You only ever push onto the top or pop off the top. Used for undo, the call stack, matching brackets and depth-first search." @ 16,6440 88x17 [in=stack]

queue: container "Queue: first in, first out" @ 130,6360 150x61
out: text "dequeue ←" @ 132,6382 22x8 [in=queue]
front_2: process "7\nfront" @ 156,6376 24x20 [in=queue fill=#FDE7C8]
q2: process "3" @ 182,6376 24x20 [in=queue]
q3: process "9" @ 208,6376 24x20 [in=queue]
back: process "4\nback" @ 234,6376 24x20 [in=queue]
into: text "← enqueue" @ 258,6382 22x8 [in=queue]
about_63: text "Queue: first in, first out. Items join at the back and leave from the front, in the order they came. Used for print jobs, message queues and breadth-first search." @ 136,6404 138x13 [in=queue]

bfs: container "Breadth-first search from A" @ 10,6481 150x131
a: ellipse "A  1" @ 76,6493 18x14 [in=bfs fill=#F6B26B]
b: ellipse "B  2" @ 40,6521 18x14 [in=bfs fill=#FDE7C8]
c: ellipse "C  3" @ 112,6521 18x14 [in=bfs fill=#FDE7C8]
d: ellipse "D  4" @ 22,6549 18x14 [in=bfs]
e: ellipse "E  5" @ 60,6549 18x14 [in=bfs]
f: ellipse "F  6" @ 112,6549 18x14 [in=bfs]
order_2: text "Visit order: A, B, C, D, E, F. Each level is finished before the next starts, using a queue." @ 16,6571 138x14 [in=bfs]
a -- b
a -- c
b -- d
b -- e
c -- f
e -- f
about_64: text "Breadth-first search: visit a graph level by level, using a queue. On an unweighted graph it finds the shortest path. Used for shortest routes, social network distances and web crawling." @ 16,6591 138x17 [in=bfs]

insertion: container "Insertion sort" @ 10,6632 190x185
start_6: terminator "List of n items" @ 74,6644 48x14 [in=insertion]
init_2: process "i = 1" @ 74,6666 48x14 [in=insertion]
more_3: decision "i < n?" @ 74,6688 48x20 [in=insertion]
take: process "key = list[i]\nj = i − 1" @ 74,6716 48x16 [in=insertion]
bigger: decision "j ≥ 0 and\nlist[j] > key?" @ 74,6740 48x22 [in=insertion]
shift: process "list[j + 1] = list[j]\nj = j − 1" @ 146,6743 46x16 [in=insertion]
place: process "list[j + 1] = key\ni = i + 1" @ 74,6774 48x16 [in=insertion]
done_5: terminator "Sorted" @ 16,6691 40x14 [in=insertion]
start_6 -> init_2
init_2 -> more_3
more_3 -> take : "yes"
more_3 -> done_5 : "no"
take -> bigger
bigger -> shift : "yes"
shift -> bigger [route=elbow beginpt=n endpt=n]
bigger -> place : "no"
place -> more_3 [route=elbow beginpt=e endpt=e]
about_65: text "Insertion sort: take each item and slide it back into place among the sorted ones before it. n² in the worst case, but very fast on lists that are nearly sorted, so real sorts use it for small runs." @ 16,6800 178x13 [in=insertion]

merge: container "Merge sort" @ 10,6837 170x147
whole: process "38  27  43  3" @ 65,6849 60x12 [in=merge]
left_half_2: process "38  27" @ 35,6871 40x12 [in=merge]
right_half_2: process "43  3" @ 115,6871 40x12 [in=merge]
one_38: process "38" @ 32,6893 18x12 [in=merge]
one_27: process "27" @ 56,6893 18x12 [in=merge]
one_43: process "43" @ 112,6893 18x12 [in=merge]
one_3: process "3" @ 136,6893 18x12 [in=merge]
left_sorted: process "27  38" @ 35,6917 40x12 [in=merge]
right_sorted: process "3  43" @ 115,6917 40x12 [in=merge]
sorted: process "3  27  38  43" @ 65,6941 60x12 [in=merge fill=#D9EAD3]
split_note: text "split" @ 12,6877 18x8 [in=merge]
merge_note: text "merge" @ 12,6923 18x8 [in=merge]
whole -> left_half_2
whole -> right_half_2
left_half_2 -> one_38
left_half_2 -> one_27
right_half_2 -> one_43
right_half_2 -> one_3
one_38 -> left_sorted
one_27 -> left_sorted
one_43 -> right_sorted
one_3 -> right_sorted
left_sorted -> sorted
right_sorted -> sorted
about_66: text "Merge sort: split the list in half until each part is one item, then merge the parts back in order. Always n log n and stable, so it is used for linked lists and big data that won't fit in memory." @ 16,6963 158x17 [in=merge]

quick: container "Quick sort" @ 10,7004 180x129
all: process "5  3  8  1  9  2" @ 60,7018 80x12 [in=quick]
pivot_note: text "pivot: the first item" @ 144,7020 44x8 [in=quick]
smaller: process "3  1  2" @ 24,7042 44x12 [in=quick]
pivot_5: process "5" @ 90,7042 20x12 [in=quick fill=#F6B26B]
larger: process "8  9" @ 132,7042 44x12 [in=quick]
smaller_2: process "1  2" @ 16,7068 30x12 [in=quick]
pivot_3: process "3" @ 50,7068 16x12 [in=quick fill=#F6B26B]
pivot_8: process "8" @ 134,7068 16x12 [in=quick fill=#F6B26B]
larger_2: process "9" @ 154,7068 16x12 [in=quick]
result: process "1  2  3  5  8  9" @ 50,7094 100x12 [in=quick fill=#D9EAD3]
all -> smaller : "< 5"
all -> pivot_5
all -> larger : "> 5"
smaller -> smaller_2
smaller -> pivot_3
larger -> pivot_8
larger -> larger_2
pivot_5 -> result : "joined in order"
about_67: text "Quick sort: pick a pivot, put smaller items before it and bigger ones after, then sort each side the same way. n log n on average and very fast in practice; it is behind many standard library sorts." @ 16,7116 168x13 [in=quick]

dfs: container "Depth-first search from A" @ 210,7004 150x131
a_2: ellipse "A  1" @ 276,7016 18x14 [in=dfs fill=#F6B26B]
b_2: ellipse "B  2" @ 240,7044 18x14 [in=dfs fill=#FDE7C8]
c_2: ellipse "C  6" @ 312,7044 18x14 [in=dfs]
d_2: ellipse "D  3" @ 222,7072 18x14 [in=dfs fill=#FDE7C8]
e_2: ellipse "E  4" @ 260,7072 18x14 [in=dfs fill=#FDE7C8]
f_2: ellipse "F  5" @ 312,7072 18x14 [in=dfs]
order_3: text "Visit order: A, B, D, E, F, C. Go as deep as possible before backing up, using a stack or recursion." @ 216,7094 138x14 [in=dfs]
a_2 -- b_2
a_2 -- c_2
b_2 -- d_2
b_2 -- e_2
c_2 -- f_2
e_2 -- f_2
about_68: text "Depth-first search: follow each path as deep as it goes before backing up, using a stack or recursion. Used for mazes, finding cycles, topological sorting and checking what can be reached." @ 216,7114 138x17 [in=dfs]

dijkstra: container "Dijkstra: shortest paths from A" @ 10,7155 176x127
a_3: ellipse "A  0" @ 18,7195 20x14 [in=dijkstra fill=#F6B26B]
b_3: ellipse "B  3" @ 66,7169 20x14 [in=dijkstra]
c_3: ellipse "C  1" @ 66,7221 20x14 [in=dijkstra]
d_3: ellipse "D  4" @ 114,7195 20x14 [in=dijkstra]
e_3: ellipse "E  7" @ 160,7195 20x14 [in=dijkstra]
note: text "Each node shows its shortest distance from A; thick lines are the shortest paths. Settle the nearest unsettled node next." @ 16,7243 164x16 [in=dijkstra]
a_3 -- b_3 : "4"
a_3 -- c_3 [weight=2.5] : "1"
c_3 -- b_3 [weight=2.5] : "2"
b_3 -- d_3 [weight=2.5] : "1"
c_3 -- d_3 : "5"
d_3 -- e_3 [weight=2.5] : "3"
about_69: text "Dijkstra's algorithm: the shortest distance from one node to every other, on a graph with no negative weights. Always settle the nearest unsettled node next. Used in sat-navs and network routing." @ 16,7265 164x13 [in=dijkstra]

hashtable: container "Hash table" @ 10,7302 170x111
hash: process "hash(key) mod 4" @ 16,7336 40x16 [in=hashtable]
bucket_0: process "0" @ 72,7316 16x12 [in=hashtable]
bucket_1: process "1" @ 72,7330 16x12 [in=hashtable]
bucket_2: process "2" @ 72,7344 16x12 [in=hashtable]
bucket_3: process "3" @ 72,7358 16x12 [in=hashtable]
apple: process "apple: 3" @ 102,7330 30x12 [in=hashtable]
pear: process "pear: 7" @ 142,7330 30x12 [in=hashtable]
kiwi: process "kiwi: 5" @ 102,7358 30x12 [in=hashtable]
collision: text "apple and pear both hash to 1, so pear is chained after apple." @ 16,7376 158x10 [in=hashtable]
hash -> bucket_1
hash -> bucket_3
bucket_1 -> apple
apple -> pear
bucket_3 -> kiwi
about_70: text "Hash table: a key's hash picks its bucket, so finding a key takes about one step whatever the size. Keys that hash to the same bucket are chained together. Behind dictionaries, maps, sets and caches." @ 16,7392 158x17 [in=hashtable]

recursion: container "Recursion: fib(4)" @ 10,7433 170x129
f4: process "fib(4)" @ 80,7445 30x12 [in=recursion]
f3: process "fib(3)" @ 44,7465 30x12 [in=recursion]
f2: process "fib(2)" @ 120,7465 30x12 [in=recursion]
f2_left: process "fib(2)" @ 24,7485 26x12 [in=recursion]
f1_left: process "fib(1)" @ 62,7485 26x12 [in=recursion fill=#D9EAD3]
f1_right: process "fib(1)" @ 106,7485 26x12 [in=recursion fill=#D9EAD3]
f0_right: process "fib(0)" @ 138,7485 26x12 [in=recursion fill=#D9EAD3]
f1_deep: process "fib(1)" @ 12,7505 24x12 [in=recursion fill=#D9EAD3]
f0_deep: process "fib(0)" @ 40,7505 24x12 [in=recursion fill=#D9EAD3]
rule: text "fib(n) = fib(n − 1) + fib(n − 2). fib(1) and fib(0), in green, stop the recursion." @ 16,7523 158x12 [in=recursion]
f4 -> f3
f4 -> f2
f3 -> f2_left
f3 -> f1_left
f2 -> f1_right
f2 -> f0_right
f2_left -> f1_deep
f2_left -> f0_deep
about_71: text "Recursion: a function that calls itself on a smaller version of the problem, down to a base case it can answer directly. Natural for trees and divide and conquer; plain fib repeats work that memoising would save." @ 16,7541 158x17 [in=recursion]

gcd: container "Euclid's GCD" @ 10,7582 170x113
start_7: terminator "Numbers a, b" @ 66,7594 48x14 [in=gcd]
zero: decision "b = 0?" @ 66,7616 48x20 [in=gcd]
step_2: process "r = a mod b\na = b,  b = r" @ 66,7648 48x16 [in=gcd]
done_6: terminator "gcd is a" @ 134,7619 40x14 [in=gcd]
start_7 -> zero
zero -> done_6 : "yes"
zero -> step_2 : "no"
step_2 -> zero [route=elbow beginpt=w endpt=w]
about_72: text "Euclid's algorithm: the greatest common divisor of two numbers, by replacing (a, b) with (b, a mod b) until b is 0. Over 2,000 years old and still used, for example in fractions and cryptography." @ 16,7674 158x17 [in=gcd]

heap: container "Binary heap" @ 10,7715 170x133
h1: ellipse "1" @ 80,7727 14x14 [in=heap fill=#F6B26B]
h3: ellipse "3" @ 50,7749 14x14 [in=heap]
h6: ellipse "6" @ 110,7749 14x14 [in=heap]
h5: ellipse "5" @ 34,7771 14x14 [in=heap]
h9: ellipse "9" @ 66,7771 14x14 [in=heap]
h8: ellipse "8" @ 96,7771 14x14 [in=heap]
index_0: text "0" @ 35,7789 18x6 [in=heap]
index_1: text "1" @ 55,7789 18x6 [in=heap]
index_2: text "2" @ 75,7789 18x6 [in=heap]
index_3: text "3" @ 95,7789 18x6 [in=heap]
index_4: text "4" @ 115,7789 18x6 [in=heap]
index_5: text "5" @ 135,7789 18x6 [in=heap]
cell_0: process "1" @ 35,7795 18x12 [in=heap]
cell_1: process "3" @ 55,7795 18x12 [in=heap]
cell_2: process "6" @ 75,7795 18x12 [in=heap]
cell_3: process "5" @ 95,7795 18x12 [in=heap]
cell_4: process "9" @ 115,7795 18x12 [in=heap]
cell_5: process "8" @ 135,7795 18x12 [in=heap]
rule_2: text "Min-heap: every parent ≤ its children. In the array, the children of i are at 2i + 1 and 2i + 2." @ 16,7813 158x10 [in=heap]
h1 -- h3
h1 -- h6
h3 -- h5
h3 -- h9
h6 -- h8
about_73: text "Binary heap: a tree where every parent is no bigger than its children, so the smallest item is always at the top. Stored in an array with no pointers. Used for priority queues, schedulers and heap sort." @ 16,7827 158x17 [in=heap]

trie: container "Trie" @ 200,7715 150x131
root: ellipse "root" @ 264,7725 20x12 [in=trie]
c_4: ellipse "c" @ 238,7747 12x12 [in=trie]
d_4: ellipse "d" @ 300,7747 12x12 [in=trie]
a_4: ellipse "a" @ 238,7769 12x12 [in=trie]
o: ellipse "o" @ 300,7769 12x12 [in=trie]
t: ellipse "t" @ 220,7791 12x12 [in=trie fill=#F6B26B]
r: ellipse "r" @ 256,7791 12x12 [in=trie fill=#F6B26B]
g: ellipse "g" @ 300,7791 12x12 [in=trie fill=#F6B26B]
words: text "Words: cat, car, dog. Shared prefixes share nodes; filled nodes end a word." @ 206,7809 138x12 [in=trie]
root -> c_4
root -> d_4
c_4 -> a_4
a_4 -> t
a_4 -> r
d_4 -> o
o -> g
about_74: text "Trie: words stored letter by letter, with words that start the same sharing nodes. Finding a word or every word with a prefix takes as many steps as the word has letters. Used for autocomplete and spell checkers." @ 206,7825 138x17 [in=trie]

lru: container "LRU cache" @ 10,7868 176x105
lookup: grid { key, node; a, →; b, →; c, → } @ 16,7882 40x30 [in=lru]
n_c: process "c" @ 74,7908 20x12 [in=lru fill=#F6B26B]
n_a: process "a" @ 112,7908 20x12 [in=lru]
n_b: process "b" @ 150,7908 20x12 [in=lru]
recent: text "most recent" @ 68,7924 32x8 [in=lru]
oldest: text "least recent" @ 144,7924 32x8 [in=lru]
rule_3: text "A hash map finds a key's node at once. A hit moves the node to the front; when full, the back one is dropped." @ 16,7938 164x14 [in=lru]
lookup ..> n_c : "finds"
n_c <-> n_a
n_a <-> n_b
about_75: text "LRU cache: keep the most recently used items and drop the least recently used when full. A hash map finds an item at once and a doubly linked list keeps the order. Used in browsers, databases and CDNs." @ 16,7956 164x13 [in=lru]

topo: container "Topological sort" @ 10,7993 172x121
shop_2: process "1  Buy ingredients" @ 16,8007 46x14 [in=topo]
preheat: process "2  Preheat oven" @ 16,8043 46x14 [in=topo]
mix: process "3  Mix batter" @ 76,8007 40x14 [in=topo]
bake: process "4  Bake" @ 134,8007 40x14 [in=topo]
cool: process "5  Cool" @ 134,8033 40x14 [in=topo]
ice: process "6  Ice the cake" @ 134,8059 40x14 [in=topo]
rule_4: text "Each task comes after everything it needs. Kahn's algorithm keeps taking a task with nothing left before it." @ 16,8065 110x24 [in=topo]
shop_2 -> mix
mix -> bake
preheat -> bake
bake -> cool
cool -> ice
about_76: text "Topological sort: put tasks in an order where each comes after everything it depends on. Only works if there are no loops. Used by build tools, package managers, spreadsheets and course planners." @ 16,8097 160x13 [in=topo]

dynamic: container "Dynamic programming: fib(6)" @ 10,8134 170x85
n_label: process "n" @ 16,8148 22x10 [in=dynamic fill=#E8EDF2]
f_label: process "fib(n)" @ 16,8158 22x12 [in=dynamic fill=#E8EDF2]
n0: process "0" @ 38,8148 19x10 [in=dynamic fill=#E8EDF2]
n1_2: process "1" @ 57,8148 19x10 [in=dynamic fill=#E8EDF2]
n2: process "2" @ 76,8148 19x10 [in=dynamic fill=#E8EDF2]
n3_2: process "3" @ 95,8148 19x10 [in=dynamic fill=#E8EDF2]
n4_2: process "4" @ 114,8148 19x10 [in=dynamic fill=#E8EDF2]
n5: process "5" @ 133,8148 19x10 [in=dynamic fill=#E8EDF2]
n6_2: process "6" @ 152,8148 19x10 [in=dynamic fill=#E8EDF2]
f0: process "0" @ 38,8158 19x12 [in=dynamic]
f1: process "1" @ 57,8158 19x12 [in=dynamic]
f2_2: process "1" @ 76,8158 19x12 [in=dynamic]
f3_2: process "2" @ 95,8158 19x12 [in=dynamic]
f4_2: process "3" @ 114,8158 19x12 [in=dynamic]
f5: process "5" @ 133,8158 19x12 [in=dynamic]
f6: process "8" @ 152,8158 19x12 [in=dynamic]
rule_5: text "Fill the table left to right: each cell is the sum of the two before it, so nothing is worked out twice (compare Recursion)." @ 16,8174 158x16 [in=dynamic]
about_77: text "Dynamic programming: solve a problem by building a table of answers to smaller problems, each worked out once. Turns many exponential problems into fast ones: shortest paths, edit distance, knapsack." @ 16,8198 158x17 [in=dynamic]

traffic: container "State machine: traffic light" @ 200,8134 140x107
start_8: initial @ 208,8154 [in=traffic]
red: state "Red" @ 224,8148 36x16 [in=traffic fill=#F4CCCC]
green: state "Green" @ 296,8148 36x16 [in=traffic fill=#D9EAD3]
amber: state "Amber" @ 260,8194 36x16 [in=traffic fill=#FCE5CD]
start_8 -> red
red -> green : "after 30 s"
green -> amber : "after 25 s"
amber -> red : "after 5 s"
about_78: text "A state machine: a set of states, and events that move it from one to another. A traffic light is the classic example. Used for UI flows, protocols, parsers and game logic." @ 206,8220 128x17 [in=traffic]

lifecycle: container "State machine: an order" @ 10,8261 236x89
start_9: initial @ 16,8281 [in=lifecycle]
placed: state "Placed" @ 30,8275 34x16 [in=lifecycle]
paid: state "Paid" @ 82,8275 34x16 [in=lifecycle]
shipped: state "Shipped" @ 134,8275 34x16 [in=lifecycle]
delivered: state "Delivered" @ 186,8275 34x16 [in=lifecycle fill=#D9EAD3]
done_7: final @ 232,8279 [in=lifecycle]
cancelled: state "Cancelled" @ 82,8309 34x16 [in=lifecycle fill=#F4CCCC]
cancelled_end: final @ 134,8312 [in=lifecycle]
start_9 -> placed
placed -> paid : "pay"
paid -> shipped : "ship"
shipped -> delivered : "deliver"
delivered -> done_7
placed -> cancelled : "cancel"
paid -> cancelled : "refund"
cancelled -> cancelled_end
about_79: text "An order's lifecycle as a state machine: each state lists what can happen next, so an order can never be shipped before it is paid. Used for orders, tickets, documents and anything with a status." @ 16,8333 224x13 [in=lifecycle]

selection: container "Selection sort" @ 10,8370 190x153
start_10: terminator "List of n items" @ 74,8382 48x14 [in=selection]
init_3: process "i = 0" @ 74,8404 48x14 [in=selection]
more_4: decision "i < n − 1?" @ 74,8426 48x20 [in=selection]
find_2: process "m = index of the\nsmallest in list[i..]" @ 74,8454 48x18 [in=selection]
swap_2: process "swap list[i], list[m]\ni = i + 1" @ 74,8480 48x18 [in=selection]
done_8: terminator "Sorted" @ 16,8429 40x14 [in=selection]
start_10 -> init_3
init_3 -> more_4
more_4 -> find_2 : "yes"
more_4 -> done_8 : "no"
find_2 -> swap_2
swap_2 -> more_4 [route=elbow beginpt=e endpt=e]
about_80: text "Selection sort: find the smallest item of what's left and swap it to the front, again and again. Always n² comparisons, but at most n swaps, so it suits data that is costly to move." @ 16,8506 178x13 [in=selection]

heapsort: container "Heap sort" @ 10,8543 190x153
start_11: terminator "List of n items" @ 74,8555 48x14 [in=heapsort]
build: process "build a max-heap\nfrom the list" @ 74,8577 48x16 [in=heapsort]
more_5: decision "heap size > 1?" @ 74,8601 48x20 [in=heapsort]
swap_3: process "swap the root (largest)\nwith the last in the heap" @ 74,8629 52x18 [in=heapsort]
shrink: process "heap size − 1\nsift the new root down" @ 74,8655 52x18 [in=heapsort]
done_9: terminator "Sorted" @ 16,8604 40x14 [in=heapsort]
start_11 -> build
build -> more_5
more_5 -> swap_3 : "yes"
more_5 -> done_9 : "no"
swap_3 -> shrink
shrink -> more_5 [route=elbow beginpt=e endpt=e]
about_81: text "Heap sort: build a max-heap from the list, then keep moving its root, the biggest item, to the end. Always n log n and needs no extra memory. Used where the worst case matters." @ 16,8679 178x13 [in=heapsort]

linear: container "Linear search" @ 10,8716 190x153
start_12: terminator "List, target" @ 74,8728 48x14 [in=linear]
init_4: process "i = 0" @ 74,8750 48x14 [in=linear]
more_6: decision "i < n?" @ 74,8772 48x20 [in=linear]
hit_2: decision "list[i] = target?" @ 74,8800 48x20 [in=linear]
next: process "i = i + 1" @ 74,8830 48x14 [in=linear]
found_2: terminator "Found at i" @ 146,8803 44x14 [in=linear]
missing_2: terminator "Not found" @ 16,8775 40x14 [in=linear]
start_12 -> init_4
init_4 -> more_6
more_6 -> hit_2 : "yes"
more_6 -alt-> missing_2 : "no"
hit_2 -> found_2 : "yes"
hit_2 -> next : "no"
next -> more_6 [route=elbow beginpt=e endpt=e]
about_82: text "Linear search: check each item in turn until the target turns up. Works on any list, sorted or not, but takes up to n checks. Fine for short lists; use binary search or a hash table for big ones." @ 16,8852 178x13 [in=linear]

astar: container "A* search" @ 10,8889 200x205
start_13: terminator "Start node, goal" @ 80,8901 52x14 [in=astar]
init_5: process "open = {start}\ng(start) = 0" @ 80,8923 52x16 [in=astar]
empty: decision "open empty?" @ 80,8947 52x20 [in=astar]
pick: process "current = node in open\nwith lowest f = g + h" @ 80,8975 52x18 [in=astar]
goal: decision "current = goal?" @ 80,9001 52x20 [in=astar]
expand: process "for each neighbour, if\ng improves: record it,\nadd it to open" @ 80,9031 52x24 [in=astar]
no_path: terminator "No path" @ 18,8950 44x14 [in=astar]
found_3: terminator "Path found: follow\nparents back" @ 150,9002 54x18 [in=astar]
note_2: text "h guesses the distance left, such as straight-line distance. With h = 0 this is Dijkstra." @ 16,9061 188x14 [in=astar]
start_13 -> init_5
init_5 -> empty
empty -alt-> no_path : "yes"
empty -> pick : "no"
pick -> goal
goal -> found_3 : "yes"
goal -> expand : "no"
expand -> empty [route=elbow beginpt=e endpt=e]
about_83: text "A* search: like Dijkstra, but heading for the goal by adding a guess of the distance left. With a good guess it looks at far fewer nodes. Used for game pathfinding and route planning." @ 16,9077 188x13 [in=astar]

kruskal: container "Minimum spanning tree (Kruskal)" @ 10,9114 176x127
a_5: ellipse "A" @ 18,9154 16x14 [in=kruskal]
b_4: ellipse "B" @ 66,9128 16x14 [in=kruskal]
c_5: ellipse "C" @ 66,9180 16x14 [in=kruskal]
d_5: ellipse "D" @ 114,9154 16x14 [in=kruskal]
e_4: ellipse "E" @ 160,9154 16x14 [in=kruskal]
note_3: text "Take edges cheapest first, skipping any that would close a loop: 1, 2, 3, 5. Thick lines are the tree, total 11." @ 16,9202 164x16 [in=kruskal]
a_5 -- b_4 : "4"
a_5 -- c_5 [weight=2.5] : "1"
b_4 -- c_5 [weight=2.5] : "2"
b_4 -- d_5 [weight=2.5] : "5"
c_5 -- d_5 : "7"
d_5 -- e_4 [weight=2.5] : "3"
about_84: text "Minimum spanning tree (Kruskal): the cheapest set of edges that joins every node, without loops. Take the cheapest edge each time unless it would make a loop. Used to plan cable, pipe and road networks." @ 16,9224 164x13 [in=kruskal]

twopointers: container "Two pointers" @ 10,9261 170x87
c0: process "1" @ 32,9277 18x14 [in=twopointers]
c1: process "3" @ 52,9277 18x14 [in=twopointers fill=#F6B26B]
c2: process "4" @ 72,9277 18x14 [in=twopointers]
c3: process "6" @ 92,9277 18x14 [in=twopointers]
c4: process "8" @ 112,9277 18x14 [in=twopointers]
c5: process "9" @ 132,9277 18x14 [in=twopointers fill=#F6B26B]
left: text "L" @ 56,9292 10x6 [in=twopointers]
right: text "R" @ 136,9292 10x6 [in=twopointers]
rule_6: text "Sorted list, target 12. Sum too small: move L right; too big: move R left. 1 + 9 = 10, so L moved; 3 + 9 = 12, found." @ 16,9303 158x16 [in=twopointers]
about_85: text "Two pointers: walk inwards from both ends of a sorted list, moving whichever end makes the answer closer. Finds pairs in one pass instead of trying every pair. Used for pair sums, reversing and palindromes." @ 16,9327 158x17 [in=twopointers]

sliding: container "Sliding window" @ 10,9368 170x93
window: container "window: 9" @ 71,9380 64x28 [in=sliding bg=off]
w0: process "2" @ 32,9390 18x14 [in=sliding]
w1: process "1" @ 52,9390 18x14 [in=sliding]
w2: process "5" @ 74,9390 18x14 [in=window fill=#FDE7C8]
w3: process "1" @ 94,9390 18x14 [in=window fill=#FDE7C8]
w4: process "3" @ 114,9390 18x14 [in=window fill=#FDE7C8]
w5: process "2" @ 138,9390 18x14 [in=sliding]
rule_7: text "Biggest sum of 3 in a row: slide the window one step at a time, adding the new item and dropping the old one." @ 16,9416 158x16 [in=sliding]
about_86: text "Sliding window: keep a running total over a window that moves along one step at a time, adding the new item and dropping the old one. Turns n×k work into n. Used for moving averages and stream statistics." @ 16,9440 158x17 [in=sliding]

queens: container "Backtracking: 4 queens" @ 200,9368 156x91
col_a: text "a" @ 214,9381 12x6 [in=queens]
col_b: text "b" @ 226,9381 12x6 [in=queens]
col_c: text "c" @ 238,9381 12x6 [in=queens]
col_d: text "d" @ 250,9381 12x6 [in=queens]
row_1: text "1" @ 206,9388 8x9 [in=queens]
row_2: text "2" @ 206,9397 8x9 [in=queens]
row_3: text "3" @ 206,9406 8x9 [in=queens]
row_4: text "4" @ 206,9415 8x9 [in=queens]
a1: process "" @ 214,9388 12x9 [in=queens]
b1: process "Q" @ 226,9388 12x9 [in=queens fill=#DCE3EB]
c1_2: process "" @ 238,9388 12x9 [in=queens]
d1: process "" @ 250,9388 12x9 [in=queens fill=#DCE3EB]
a2: process "" @ 214,9397 12x9 [in=queens fill=#DCE3EB]
b2: process "" @ 226,9397 12x9 [in=queens]
c2_2: process "" @ 238,9397 12x9 [in=queens fill=#DCE3EB]
d2: process "Q" @ 250,9397 12x9 [in=queens]
a3: process "Q" @ 214,9406 12x9 [in=queens]
b3: process "" @ 226,9406 12x9 [in=queens fill=#DCE3EB]
c3_2: process "" @ 238,9406 12x9 [in=queens]
d3: process "" @ 250,9406 12x9 [in=queens fill=#DCE3EB]
a4: process "" @ 214,9415 12x9 [in=queens fill=#DCE3EB]
b4: process "" @ 226,9415 12x9 [in=queens]
c4_2: process "Q" @ 238,9415 12x9 [in=queens fill=#DCE3EB]
d4: process "" @ 250,9415 12x9 [in=queens]
rule_8: text "Place a queen in each row, trying each column. If a row has no safe square, go back a row and move that queen on. This is the first full answer." @ 274,9382 76x44 [in=queens]
about_87: text "Backtracking: build a solution one choice at a time, and undo the last choice as soon as it can't work. Used for puzzles like Sudoku and N-queens, timetabling and searching all combinations." @ 206,9438 144x17 [in=queens]

doubly: container "Doubly linked list" @ 10,9481 196x57
front_3: text "null" @ 12,9497 14x8 [in=doubly]
prev_1: process "prev" @ 30,9495 13x12 [in=doubly fill=#E8EDF2]
val_1: process "12" @ 43,9495 14x12 [in=doubly]
next_1: process "next" @ 57,9495 13x12 [in=doubly fill=#E8EDF2]
prev_2: process "prev" @ 86,9495 13x12 [in=doubly fill=#E8EDF2]
val_2: process "99" @ 99,9495 14x12 [in=doubly]
next_2: process "next" @ 113,9495 13x12 [in=doubly fill=#E8EDF2]
prev_3: process "prev" @ 142,9495 13x12 [in=doubly fill=#E8EDF2]
val_3: process "37" @ 155,9495 14x12 [in=doubly]
next_3: process "next" @ 169,9495 13x12 [in=doubly fill=#E8EDF2]
back_2: text "null" @ 190,9497 14x8 [in=doubly]
prev_1 -> front_3
next_1 <-> prev_2
next_2 <-> prev_3
next_3 -> back_2
about_88: text "Doubly linked list: each node points to the one before and the one after, so it can be walked both ways and a node removed without searching. Used for LRU caches, browser history and text editors." @ 16,9521 184x13 [in=doubly]

adjacency: container "Graph: adjacency matrix and list" @ 10,9558 204x97
a_6: ellipse "A" @ 18,9580 14x14 [in=adjacency]
b_5: ellipse "B" @ 50,9572 14x14 [in=adjacency]
c_6: ellipse "C" @ 50,9604 14x14 [in=adjacency]
d_6: ellipse "D" @ 82,9596 14x14 [in=adjacency]
matrix: grid { " ", A, B, C, D; A, 0, 1, 1, 0; B, 1, 0, 1, 0; C, 1, 1, 0, 1; D, 0, 0, 1, 0 } @ 104,9572 52x30 [in=adjacency]
list: grid { node, neighbours; A, B C; B, A C; C, A B D; D, C } @ 162,9572 46x30 [in=adjacency]
matrix_note: text "Matrix: quick to check an edge" @ 104,9620 52x10 [in=adjacency]
list_note: text "List: small for sparse graphs" @ 162,9620 46x10 [in=adjacency]
a_6 -- b_5
a_6 -- c_6
b_5 -- c_6
c_6 -- d_6
about_89: text "Two ways to store a graph. An adjacency matrix has a cell for every pair of nodes; an adjacency list keeps each node's neighbours. Matrices suit dense graphs, lists sparse ones such as roads or social networks." @ 16,9638 192x13 [in=adjacency]

ring: container "Ring buffer" @ 10,9675 170x71
s0: process " " @ 30,9697 18x14 [in=ring]
s1: process "7" @ 52,9697 18x14 [in=ring fill=#FDE7C8]
s2: process "3" @ 74,9697 18x14 [in=ring fill=#FDE7C8]
s3: process "9" @ 96,9697 18x14 [in=ring fill=#FDE7C8]
s4: process "4" @ 118,9697 18x14 [in=ring fill=#FDE7C8]
s5: process " " @ 140,9697 18x14 [in=ring]
read: text "read ↓" @ 50,9687 22x8 [in=ring]
write: text "write ↓" @ 138,9687 22x8 [in=ring]
s5 -> s0 [route=elbow beginpt=s endpt=s] : "wraps round to the start"
about_90: text "Ring buffer: a fixed-size queue whose end wraps round to its start, so nothing is ever moved or reallocated. Used for audio and network buffers, logs and producer and consumer queues." @ 16,9729 158x13 [in=ring]

bellman: container "Bellman-Ford: shortest paths from S" @ 200,9675 156x121
s: ellipse "S: 0" @ 208,9709 22x14 [in=bellman fill=#FDE7C8]
a_7: ellipse "A: 2" @ 264,9687 22x14 [in=bellman]
b_6: ellipse "B: 5" @ 264,9731 22x14 [in=bellman]
c_7: ellipse "C: 4" @ 324,9687 22x14 [in=bellman]
note_4: text "Relax every edge, n − 1 times. B → A costs −3, so A drops from 4 to 2, and C to 4. If a pass still improves anything, there's a negative cycle." @ 206,9753 144x16 [in=bellman]
s -> a_7 : "4"
s -> b_6 : "5"
b_6 -> a_7 : "−3"
a_7 -> c_7 : "2"
b_6 -> c_7 : "6"
about_91: text "Bellman-Ford: shortest paths from one node, even when some edges are negative. Relax every edge n − 1 times; a pass that still improves something means a negative cycle. Used in network routing (distance vector)." @ 206,9775 144x17 [in=bellman]

unionfind: container "Union-find (disjoint sets)" @ 10,9816 170x125
n1_3: ellipse "1" @ 40,9828 14x14 [in=unionfind fill=#FDE7C8]
n2_2: ellipse "2" @ 22,9856 14x14 [in=unionfind]
n3_3: ellipse "3" @ 58,9856 14x14 [in=unionfind]
n4_3: ellipse "4" @ 58,9882 14x14 [in=unionfind]
n5_2: ellipse "5" @ 102,9828 14x14 [in=unionfind fill=#FDE7C8]
n6_3: ellipse "6" @ 102,9856 14x14 [in=unionfind]
ops: text "union(1, 2)\nunion(3, 4)\nunion(2, 4)\nunion(5, 6)\nfind(4) = 1\nfind(6) = 5" @ 130,9828 44x40 [in=unionfind]
note_5: text "Each item points at its parent; a root names its set. find follows the pointers up, union joins two roots." @ 16,9902 158x12 [in=unionfind]
n2_2 -> n1_3
n3_3 -> n1_3
n4_3 -> n3_3
n6_3 -> n5_2
about_92: text "Union-find (disjoint sets): keeps track of which group each item is in. Each item points at a parent, and the root names the group. Used in Kruskal's algorithm, network connectivity and image regions." @ 16,9920 158x17 [in=unionfind]

kmp: container "KMP string search: finding ABABC" @ 200,9816 156x105
text_label: text "Text" @ 206,9830 24x12 [in=kmp]
t0: process "A" @ 232,9830 14x12 [in=kmp]
t1: process "B" @ 248,9830 14x12 [in=kmp]
t2: process "A" @ 264,9830 14x12 [in=kmp]
t3: process "B" @ 280,9830 14x12 [in=kmp]
t4: process "A" @ 296,9830 14x12 [in=kmp]
t5: process "B" @ 312,9830 14x12 [in=kmp]
t6: process "C" @ 328,9830 14x12 [in=kmp]
pattern_label: text "Pattern" @ 206,9848 24x12 [in=kmp]
p0: process "A" @ 232,9848 14x12 [in=kmp fill=#DCE3EB]
p1: process "B" @ 248,9848 14x12 [in=kmp fill=#DCE3EB]
p2: process "A" @ 264,9848 14x12 [in=kmp fill=#DCE3EB]
p3: process "B" @ 280,9848 14x12 [in=kmp fill=#DCE3EB]
p4: process "C" @ 296,9848 14x12 [in=kmp fill=#DCE3EB]
table_label: text "Table" @ 206,9862 24x12 [in=kmp]
f0_2: process "0" @ 232,9862 14x12 [in=kmp fill=#FDE7C8]
f1_2: process "0" @ 248,9862 14x12 [in=kmp fill=#FDE7C8]
f2_3: process "1" @ 264,9862 14x12 [in=kmp fill=#FDE7C8]
f3_3: process "2" @ 280,9862 14x12 [in=kmp fill=#FDE7C8]
f4_3: process "0" @ 296,9862 14x12 [in=kmp fill=#FDE7C8]
note_6: text "The table: how much of the pattern still matches after a mismatch, so the text is never read twice." @ 206,9880 144x14 [in=kmp]
about_93: text "KMP (Knuth-Morris-Pratt) string search: a table built from the pattern says how much of it still matches after a mismatch, so the search never moves backwards in the text. Used in text editors, search and DNA matching." @ 206,9900 144x17 [in=kmp]

huffman: container "Huffman coding" @ 10,9961 172x121
root_2: ellipse "9" @ 80,9973 18x14 [in=huffman]
a_8: ellipse "A 5" @ 46,9997 18x14 [in=huffman fill=#FDE7C8]
n4_4: ellipse "4" @ 114,9997 18x14 [in=huffman]
b_7: ellipse "B 2" @ 90,10021 18x14 [in=huffman fill=#FDE7C8]
n2_3: ellipse "2" @ 138,10021 18x14 [in=huffman]
c_8: ellipse "C 1" @ 118,10045 18x14 [in=huffman fill=#FDE7C8]
d_7: ellipse "D 1" @ 158,10045 18x14 [in=huffman fill=#FDE7C8]
codes: text "A = 0\nB = 10\nC = 110\nD = 111" @ 16,10023 40x24 [in=huffman]
root_2 -- a_8 : "0"
root_2 -- n4_4 : "1"
n4_4 -- b_7 : "0"
n4_4 -- n2_3 : "1"
n2_3 -- c_8 : "0"
n2_3 -- d_7 : "1"
about_94: text "Huffman coding: give common symbols short codes and rare ones long codes, by repeatedly joining the two rarest into a tree. No code is the start of another. Used inside ZIP, PNG, JPEG and MP3." @ 16,10065 160x13 [in=huffman]

avl: container "AVL tree: a left rotation" @ 10,10102 166x113
b10: ellipse "10" @ 24,10114 16x14 [in=avl fill=#F4CCCC]
b20: ellipse "20" @ 44,10138 16x14 [in=avl]
b30: ellipse "30" @ 64,10162 16x14 [in=avl fill=#FDE7C8]
arrow: text "rotate left →" @ 84,10140 30x10 [in=avl]
a20: ellipse "20" @ 132,10124 16x14 [in=avl fill=#D9EAD3]
a10: ellipse "10" @ 112,10152 16x14 [in=avl]
a30: ellipse "30" @ 152,10152 16x14 [in=avl fill=#FDE7C8]
note_7: text "Adding 30 made 10 two levels taller on the right." @ 16,10180 154x8 [in=avl]
b10 -> b20
b20 -> b30
a20 -> a10
a20 -> a30
about_95: text "AVL tree: a binary search tree that rebalances itself. When one side gets two levels taller than the other, a rotation lifts the middle node up. Keeps searches at about log2(n) steps. Red-black trees work the same way." @ 16,10194 154x17 [in=avl]

btree: container "B-tree: finding 30" @ 196,10102 152x103
root_3: process "20    40" @ 252,10114 40x12 [in=btree]
left_2: process "5    10" @ 202,10146 40x12 [in=btree]
middle: process "25    30" @ 252,10146 40x12 [in=btree]
right_2: process "45    50" @ 302,10146 40x12 [in=btree]
note_8: text "Each node holds sorted keys, and one more child than keys. 30 is between 20 and 40: the middle child." @ 202,10166 140x12 [in=btree]
root_3 -> left_2 : "< 20"
root_3 -> middle : "20 – 40"
root_3 -> right_2 : "> 40"
about_96: text "B-tree: a search tree whose nodes hold many sorted keys, so it is short and wide and a search reads only a few nodes. Nodes split as they fill. Behind almost every database index and file system." @ 202,10184 140x17 [in=btree]

skiplist: container "Skip list: finding 7" @ 10,10235 164x105
level_2: text "Level 2" @ 16,10249 22x12 [in=skiplist]
level_1: text "Level 1" @ 16,10267 22x12 [in=skiplist]
level_0: text "Level 0" @ 16,10285 22x12 [in=skiplist]
l2_head: process "Head" @ 40,10249 16x12 [in=skiplist fill=#DCE3EB]
l2_9: process "9" @ 128,10249 16x12 [in=skiplist]
l1_head: process "Head" @ 40,10267 16x12 [in=skiplist fill=#DCE3EB]
l1_5: process "5" @ 84,10267 16x12 [in=skiplist]
l1_9: process "9" @ 128,10267 16x12 [in=skiplist]
l0_head: process "Head" @ 40,10285 16x12 [in=skiplist fill=#DCE3EB]
l0_3: process "3" @ 62,10285 16x12 [in=skiplist]
l0_5: process "5" @ 84,10285 16x12 [in=skiplist]
l0_7: process "7" @ 106,10285 16x12 [in=skiplist]
l0_9: process "9" @ 128,10285 16x12 [in=skiplist]
l0_12: process "12" @ 150,10285 16x12 [in=skiplist]
note_9: text "Each level skips more. Go right while the next is smaller, else drop down." @ 16,10303 152x12 [in=skiplist]
l2_head -> l2_9
l1_head -> l1_5
l1_5 -> l1_9
l0_head -> l0_3
l0_3 -> l0_5
l0_5 -> l0_7
l0_7 -> l0_9
l0_9 -> l0_12
about_97: text "Skip list: a sorted linked list with extra levels that skip ahead, like express lanes. Search, insert and delete take about log2(n) steps, with no rebalancing. Used in Redis sorted sets and in databases." @ 16,10319 152x17 [in=skiplist]

bloom: container "Bloom filter" @ 194,10235 162x109
cat: process "add cat" @ 228,10247 26x12 [in=bloom]
dog: process "add dog" @ 306,10247 26x12 [in=bloom]
b0: process "0" @ 202,10275 13x12 [in=bloom]
b1_2: process "1" @ 217,10275 13x12 [in=bloom fill=#FDE7C8]
b2_2: process "0" @ 232,10275 13x12 [in=bloom]
b3_2: process "1" @ 247,10275 13x12 [in=bloom fill=#FDE7C8]
b4_2: process "1" @ 262,10275 13x12 [in=bloom fill=#FDE7C8]
b5: process "0" @ 277,10275 13x12 [in=bloom]
b6: process "0" @ 292,10275 13x12 [in=bloom]
b7: process "0" @ 307,10275 13x12 [in=bloom]
b8: process "1" @ 322,10275 13x12 [in=bloom fill=#FDE7C8]
b9: process "1" @ 337,10275 13x12 [in=bloom fill=#FDE7C8]
fox: process "is fox in?" @ 244,10303 30x12 [in=bloom]
note_10: text "fox hashes to 1, 3, 6: bit 6 is 0, so no." @ 280,10303 70x12 [in=bloom]
cat -> b1_2
cat -> b4_2
cat -> b3_2
dog -> b8
dog -> b4_2
dog -> b9
fox ..> b1_2
fox ..> b3_2
fox ..> b6
about_98: text "Bloom filter: a row of bits that answers \"definitely not added\" or \"probably added\", using very little memory. Each item sets a few bits chosen by hashes. Used to skip pointless disk reads and in caches and spam filters." @ 200,10323 150x17 [in=bloom]

network: container "Neural network" @ 10,10364 140x125
input_label: text "Input" @ 16,10376 24x8 [in=network]
hidden_label: text "Hidden" @ 66,10376 24x8 [in=network]
output_label: text "Output" @ 114,10376 24x8 [in=network]
x1: ellipse "x1" @ 22,10394 12x12 [in=network fill=#DCE3EB]
x2: ellipse "x2" @ 22,10412 12x12 [in=network fill=#DCE3EB]
x3: ellipse "x3" @ 22,10430 12x12 [in=network fill=#DCE3EB]
h1_2: ellipse "h1" @ 72,10386 12x12 [in=network fill=#FDE7C8]
h2: ellipse "h2" @ 72,10404 12x12 [in=network fill=#FDE7C8]
h3_2: ellipse "h3" @ 72,10422 12x12 [in=network fill=#FDE7C8]
h4: ellipse "h4" @ 72,10440 12x12 [in=network fill=#FDE7C8]
y1: ellipse "y1" @ 120,10404 12x12 [in=network fill=#D9EAD3]
y2: ellipse "y2" @ 120,10422 12x12 [in=network fill=#D9EAD3]
rule_9: text "Each line has a weight. A node adds up its weighted inputs, then applies an activation." @ 16,10456 128x8 [in=network]
x1 -- h1_2
x1 -- h2
x1 -- h3_2
x1 -- h4
x2 -- h1_2
x2 -- h2
x2 -- h3_2
x2 -- h4
x3 -- h1_2
x3 -- h2
x3 -- h3_2
x3 -- h4
h1_2 -- y1
h1_2 -- y2
h2 -- y1
h2 -- y2
h3_2 -- y1
h3_2 -- y2
h4 -- y1
h4 -- y2
about_99: text "Neural network: layers of nodes, each joined to every node in the next layer by a weighted line. Training sets the weights so inputs map to the right outputs. Used for images, speech, text and predictions." @ 16,10468 128x17 [in=network]

training: container "Training loop" @ 170,10364 190x203
start_14: terminator "Data, and a model\nwith random weights" @ 234,10376 52x16 [in=training]
batch: process "Take a batch" @ 234,10400 52x14 [in=training]
forward: process "Forward pass:\nmake predictions" @ 234,10422 52x16 [in=training]
loss: process "Loss: how wrong\nthe predictions are" @ 234,10446 52x16 [in=training]
backward: process "Backward pass:\nwork out gradients" @ 234,10470 52x16 [in=training]
update: process "Update the weights:\nw = w − rate × gradient" @ 234,10494 52x16 [in=training]
more_7: decision "More epochs?" @ 234,10518 52x22 [in=training]
done_10: terminator "Trained model" @ 176,10521 44x16 [in=training]
start_14 -> batch
batch -> forward
forward -> loss
loss -> backward
backward -> update
update -> more_7
more_7 -> batch [route=elbow beginpt=e endpt=e] : "yes"
more_7 -> done_10 : "no"
about_100: text "The training loop: how a model learns. Show it a batch, measure how wrong it was, work out which way to nudge each weight, nudge them, repeat. One pass over all the data is an epoch." @ 176,10550 178x13 [in=training]

descent: container "Gradient descent" @ 10,10587 170x103
curve: line "Loss, step by step" { 9, 6.2, 4.3, 3, 2.1, 1.5, 1.1, 0.9 } @ 16,10601 80x64 [in=descent]
step_3: process "w = w − rate × ∂L/∂w" @ 106,10603 68x16 [in=descent fill=#DCE3EB]
notes: text "Each step moves the weights a little downhill on the loss. Too big a rate overshoots the bottom; too small takes for ever." @ 106,10625 68x36 [in=descent]
about_101: text "Gradient descent: find the weights with the lowest loss by repeatedly stepping downhill, against the gradient. The learning rate sets the step size. It trains almost every neural network." @ 16,10673 158x13 [in=descent]

backprop: container "Backpropagation" @ 10,10710 230x97
input: process "Input x" @ 16,10740 30x20 [in=backprop]
layer_1: process "Layer 1\nh1 = f(W1 x)" @ 74,10740 36x20 [in=backprop]
layer_2: process "Layer 2\nh2 = f(W2 h1)" @ 138,10740 36x20 [in=backprop]
loss_2: process "Loss L" @ 202,10740 30x20 [in=backprop fill=#F6B26B]
input -> layer_1 [beginpt=e@0.3 endpt=w@0.3] : "forward"
layer_1 -> layer_2 [beginpt=e@0.3 endpt=w@0.3]
layer_2 -> loss_2 [beginpt=e@0.3 endpt=w@0.3]
loss_2 ..> layer_2 [beginpt=w@0.75 endpt=e@0.75] : "∂L/∂h2"
layer_2 ..> layer_1 [beginpt=w@0.75 endpt=e@0.75] : "∂L/∂h1"
rule_10: text "Forward: work out the prediction and the loss. Backward: the chain rule passes the gradient of the loss back, layer by layer, to every weight." @ 16,10768 218x14 [in=backprop]
about_102: text "Backpropagation: work out how much each weight contributed to the error, by passing the loss's gradient backwards through the layers with the chain rule. It is how neural networks get their gradients." @ 16,10790 218x13 [in=backprop]

cnn: container "Convolutional neural network" @ 10,10827 202x81
image: process "Image\n28 × 28" @ 16,10843 22x20 [in=cnn fill=#DCE3EB]
conv_1: process "Conv\n+ ReLU" @ 44,10843 22x20 [in=cnn fill=#FDE7C8]
pool_1: process "Pool" @ 72,10843 22x20 [in=cnn fill=#FCE5CD]
conv_2: process "Conv\n+ ReLU" @ 100,10843 22x20 [in=cnn fill=#FDE7C8]
pool_2: process "Pool" @ 128,10843 22x20 [in=cnn fill=#FCE5CD]
dense: process "Dense" @ 156,10843 22x20 [in=cnn]
classes: process "Classes" @ 184,10843 22x20 [in=cnn fill=#D9EAD3]
rule_11: text "Convolutions find local features with small shared filters; pooling shrinks the map; dense layers decide." @ 16,10871 190x12 [in=cnn]
image -> conv_1
conv_1 -> pool_1
pool_1 -> conv_2
conv_2 -> pool_2
pool_2 -> dense
dense -> classes
about_103: text "Convolutional neural network: small filters slide over an image to find edges, then shapes, then objects, with pooling shrinking the image between. The standard network for images and video." @ 16,10891 190x13 [in=cnn]

transformer: container "Transformer block" @ 232,10827 120x172
tokens: process "Token embeddings\n+ positions" @ 262,10839 60x16 [in=transformer fill=#DCE3EB]
attention: process "Multi-head\nself-attention" @ 262,10863 60x16 [in=transformer fill=#FDE7C8]
norm_1: process "Add & norm" @ 262,10887 60x14 [in=transformer]
feed: process "Feed-forward" @ 262,10909 60x14 [in=transformer fill=#FCE5CD]
norm_2: process "Add & norm" @ 262,10931 60x14 [in=transformer]
next_4: text "to the next block" @ 262,10955 60x8 [in=transformer]
tokens -> attention
attention -> norm_1
norm_1 -> feed
feed -> norm_2
norm_2 -> next_4
tokens -> norm_1 [route=elbow beginpt=e endpt=e@0.3] : "skip"
norm_1 -> norm_2 [route=elbow beginpt=e@0.7 endpt=e] : "skip"
about_104: text "Transformer block: self-attention lets every token look at every other token, then a feed-forward layer works on each one; skip connections and normalisation keep it stable. Stacked, it is the basis of LLMs." @ 238,10973 108x22 [in=transformer]

tree: container "Decision tree: play outside?" @ 10,11019 170x115
outlook: decision "Outlook?" @ 73,11031 44x18 [in=tree]
humid: decision "Humid?" @ 24,11061 44x18 [in=tree]
overcast_play: terminator "Play" @ 79,11065 32x12 [in=tree fill=#D9EAD3]
windy: decision "Windy?" @ 122,11061 44x18 [in=tree]
humid_no: terminator "Stay in" @ 14,11095 30x12 [in=tree fill=#F4CCCC]
humid_play: terminator "Play" @ 48,11095 26x12 [in=tree fill=#D9EAD3]
windy_no: terminator "Stay in" @ 116,11095 30x12 [in=tree fill=#F4CCCC]
windy_play: terminator "Play" @ 150,11095 26x12 [in=tree fill=#D9EAD3]
outlook -> humid : "sunny"
outlook -> overcast_play : "overcast"
outlook -> windy : "rain"
humid -> humid_no : "yes"
humid -> humid_play : "no"
windy -> windy_no : "yes"
windy -> windy_play : "no"
about_105: text "Decision tree: a series of yes/no questions about the data, each answer a branch, ending in a decision. Easy to read and explain; many trees together make random forests and gradient boosting." @ 16,11117 158x13 [in=tree]

kmeans: container "k-means clustering" @ 10,11154 202x147
start_15: terminator "Points, k" @ 26,11166 44x12 [in=kmeans]
init_6: process "Pick k centres\nat random" @ 26,11184 44x16 [in=kmeans]
assign: process "Give each point to\nits nearest centre" @ 26,11208 44x16 [in=kmeans]
move: process "Move each centre to\nits points' middle" @ 26,11232 44x16 [in=kmeans]
changed: decision "Any point\nchanged centre?" @ 26,11256 44x20 [in=kmeans]
done_11: terminator "k clusters" @ 80,11259 32x14 [in=kmeans]
points: scatter "Three clusters" { 2, 3; 3, 2; 2.5, 4; 3.5, 3; 7, 8; 8, 7; 7.5, 9; 8.5, 8; 8, 2; 9, 3; 7.5, 1.5; 9, 2 } @ 120,11168 86x80 [in=kmeans]
start_15 -> init_6
init_6 -> assign
assign -> move
move -> changed
changed -> assign [route=elbow beginpt=w endpt=w] : "yes"
changed -> done_11 : "no"
about_106: text "k-means clustering: split data into k groups by giving each point to its nearest centre, then moving each centre to the middle of its points, until nothing changes. Used for customer segments and grouping." @ 16,11284 190x13 [in=kmeans]

confusion: container "Confusion matrix" @ 10,11321 150x87
corner: process "" @ 16,11335 38x8 [in=confusion fill=#E8EDF2]
pred_yes: process "Predicted yes" @ 54,11335 50x8 [in=confusion fill=#E8EDF2]
pred_no: process "Predicted no" @ 104,11335 50x8 [in=confusion fill=#E8EDF2]
act_yes: process "Actually yes" @ 16,11343 38x10 [in=confusion fill=#E8EDF2]
tp: process "40 true positives" @ 54,11343 50x10 [in=confusion fill=#D9EAD3]
fn: process "10 false negatives" @ 104,11343 50x10 [in=confusion fill=#F4CCCC]
act_no: process "Actually no" @ 16,11353 38x10 [in=confusion fill=#E8EDF2]
fp: process "5 false positives" @ 54,11353 50x10 [in=confusion fill=#F4CCCC]
tn: process "45 true negatives" @ 104,11353 50x10 [in=confusion fill=#D9EAD3]
scores: text "Accuracy 85%: (40 + 45) ÷ 100.  Precision 89%: 40 ÷ 45.  Recall 80%: 40 ÷ 50." @ 16,11369 138x12 [in=confusion]
about_107: text "Confusion matrix: a model's predictions against the truth, as right and wrong yeses and noes. Accuracy, precision and recall all come from it. Use it to judge any classifier, especially when one class is rare." @ 16,11387 138x17 [in=confusion]

pipeline: container "Machine learning pipeline" @ 10,11428 244x71
data_2: database "Raw data" @ 16,11444 24x24 [in=pipeline]
clean: process "Clean and\nlabel" @ 46,11447 28x18 [in=pipeline]
features: process "Features" @ 80,11447 28x18 [in=pipeline]
split: process "Split: train,\nvalidation, test" @ 114,11447 34x18 [in=pipeline]
train: process "Train" @ 154,11447 22x18 [in=pipeline]
evaluate: decision "Good\nenough?" @ 182,11444 28x24 [in=pipeline]
deploy: terminator "Deploy" @ 222,11450 26x14 [in=pipeline fill=#D9EAD3]
data_2 -> clean
clean -> features
features -> split
split -> train
train -> evaluate
evaluate -> deploy : "yes"
evaluate -alt-> features [route=elbow beginpt=s endpt=s] : "no: rework the features"
about_108: text "A machine learning pipeline: the steps from raw data to a model in use. Most of the work is in the data, and the loop back from evaluation is where models get better. MLOps tools run it." @ 16,11482 232x13 [in=pipeline]

rnn: container "Recurrent network (RNN / LSTM)" @ 10,11519 164x125
y1_2: ellipse "y1" @ 30,11531 16x12 [in=rnn fill=#D9EAD3]
y2_2: ellipse "y2" @ 80,11531 16x12 [in=rnn fill=#D9EAD3]
y3: ellipse "y3" @ 130,11531 16x12 [in=rnn fill=#D9EAD3]
h1_3: process "cell" @ 24,11557 28x16 [in=rnn fill=#FDE7C8]
h2_2: process "cell" @ 74,11557 28x16 [in=rnn fill=#FDE7C8]
h3_3: process "cell" @ 124,11557 28x16 [in=rnn fill=#FDE7C8]
x1_2: ellipse "The" @ 28,11587 20x12 [in=rnn fill=#DCE3EB]
x2_2: ellipse "cat" @ 78,11587 20x12 [in=rnn fill=#DCE3EB]
x3_2: ellipse "sat" @ 128,11587 20x12 [in=rnn fill=#DCE3EB]
note_11: text "The same cell, step by step. An LSTM cell adds gates to keep or forget." @ 16,11605 152x12 [in=rnn]
x1_2 -> h1_3
x2_2 -> h2_2
x3_2 -> h3_3
h1_3 -> y1_2
h2_2 -> y2_2
h3_3 -> y3
h1_3 -> h2_2 : "state"
h2_2 -> h3_3 : "state"
about_109: text "Recurrent neural network: one cell reads a sequence a step at a time, passing a state on to the next step as its memory. An LSTM's gates let it remember for longer. Used for text, speech and time series, before transformers." @ 16,11623 152x17 [in=rnn]

autoencoder: container "Autoencoder" @ 10,11664 190x97
input_2: process "Input\n784" @ 16,11678 26x56 [in=autoencoder fill=#DCE3EB]
encoder: process "Encoder" @ 54,11688 26x36 [in=autoencoder fill=#FDE7C8]
code: process "Code\n32" @ 92,11698 26x16 [in=autoencoder fill=#D9EAD3]
decoder: process "Decoder" @ 130,11688 26x36 [in=autoencoder fill=#FDE7C8]
output: process "Rebuilt\n784" @ 168,11678 26x56 [in=autoencoder fill=#DCE3EB]
input_2 -> encoder
encoder -> code
code -> decoder
decoder -> output
about_110: text "Autoencoder: a network trained to rebuild its own input through a small middle layer, so that layer learns a compact code. Used for compression, removing noise and spotting unusual data: a bad rebuild means unusual input." @ 16,11740 178x17 [in=autoencoder]

rl: container "Reinforcement learning loop" @ 10,11781 180x123
agent: process "Agent\nits policy picks" @ 24,11815 48x20 [in=rl fill=#FDE7C8]
environment: process "Environment\ngame, robot, market" @ 128,11815 48x20 [in=rl fill=#DCE3EB]
learn: process "Learn: do more of\nwhat earned reward" @ 94,11859 48x16 [in=rl fill=#D9EAD3]
agent -> environment [route=elbow beginpt=n endpt=n] : "action"
environment -> learn [route=elbow beginpt=s endpt=e] : "new state, reward"
learn -> agent [route=elbow beginpt=w endpt=s]
about_111: text "Reinforcement learning: an agent learns by trial and error. It acts, the environment answers with a new state and a reward, and it learns to choose actions that earn the most reward over time. Used for games, robots and tuning LLMs." @ 16,11883 168x17 [in=rl]

curves: container "Training and validation curves" @ 10,11924 172x113
chart: line "Loss per epoch" { 9, 6, 4.2, 3, 2.2, 1.6, 1.1, 0.8; 9.4, 6.8, 5, 4.1, 3.8, 3.9, 4.3, 4.9 } @ 16,11938 90x64 [in=curves colours=#2B3A47,#C4741E]
key_row: legendrow "Training | Validation" @ 16,12004 90x8 [in=curves colours=#2B3A47,#C4741E]
train_2: process "Train 70%:\nlearn the weights" @ 114,11938 62x14 [in=curves fill=#DCE3EB]
val: process "Validate 15%:\ntune, pick when to stop" @ 114,11956 62x14 [in=curves fill=#FDE7C8]
test: process "Test 15%:\nthe final score" @ 114,11974 62x14 [in=curves fill=#D9EAD3]
note_12: text "Validation loss rises after epoch 5: overfitting." @ 114,11992 62x16 [in=curves]
about_112: text "Training and validation curves: loss on the training data and on held-back data, epoch by epoch. When validation loss turns up while training loss still falls, the model is overfitting. Used to choose when to stop training." @ 16,12016 160x17 [in=curves]
```

## app-wireframe

A whole app screen wireframed with placed shapes; later lines are drawn on top.

```
flow 1
page "1 Editor" size 425x326 direction LR

# DesignRoutes's own screen, wireframed in DesignRoutes. The numbered badges match the regions in
# docs/app-plan.md. Shapes later in the file are drawn on top, so the window comes first.

win: browser "DesignRoutes" @ 10,10 400x250
toolbar: navbar "DesignRoutes | New | Open | Save | Save as | Import | Export | Undo | Redo | − 100% + | Fit | Tour" @ 12,47 396x12
palette: sidebar "Connect | Text | Flowchart | Database | UI wireframe | BI / dashboards | Systems" @ 12,62 42x170
stage: process "" @ 56,62 190x170 [fill=#E9EEF2]
paper: process "" @ 64,70 174x140
s1: terminator "Start" @ 80,78 36x11
s2: process "Step" @ 80,98 36x13
s3: decision "OK?" @ 80,120 36x20
s4: process "Retry" @ 140,122 36x16
paneTitle: text "Text" @ 249,62 14x9
paneLang: dropdown "Flow (live)" @ 264,62 36x9
panePin: button "Pin" @ 302,62 15x9
paneHide: button "Hide" @ 319,62 17x9
paneCode: textarea "flow 1\npage \"Page 1\"\ns1: terminator \"Start\" @ 17.5,14.8\ns2: process \"Step\" @ 17.5,46\ns3: decision \"OK?\" @ 10,79.4\ns4: process \"Retry\" @ 85,88.4\ns1 -> s2\ns2 -> s3\ns3 -> s4 : \"no\"" @ 249,74 87x158
propsTitle: text "Page" @ 339,62 69x9
propsName: field "Page 1" @ 339,73 69x9
propsSize: dropdown "Custom" @ 339,85 69x9
propsW: field "297" @ 339,97 33x9
propsH: field "210" @ 375,97 33x9
propsFit: button "Fit page to content" @ 339,110 69x10
propsDel: button "Delete this page" @ 339,123 69x10 [fill=#FBEAEA]
propsMore: accordion "Getting started | Connections | Shortcuts" @ 339,138 69x60
tabs: tabs "Page 1 | Page 2 | +" @ 12,235 120x10
toast: alert "Opened example.flow." @ 120,217 100x10

# Each connection is drawn just above the later of the shapes it joins, so these show over the stage.
s1 -> s2
s2 -> s3
s3 -> s4 : "no"

b1: badge "1" @ 400,44 8x6
b2: badge "2" @ 44,64 8x6
b3: badge "3" @ 236,64 8x6
b4: badge "4" @ 326,76 8x6
b5: badge "5" @ 398,64 8x6
b6: badge "6" @ 122,236 8x6
b7: badge "7" @ 222,219 8x6

notes: text "1 Toolbar: file, history and view commands; each has a keyboard shortcut\n2 Palette: click a shape to add it in the middle of the view, or drag it onto the page\n3 Stage: the page; select, move, resize, connect and edit text in place\n4 Text pane: the page as .flow text, live in both directions; Ctrl+E shows or hides it\n5 Properties: the page when nothing is selected, otherwise the selection (page 3)\n6 Page tabs: one per page; + adds one\n7 Toast: a short confirmation that fades by itself" @ 10,266 400x45

page "2 Dialogs and tour" size 467x190 direction LR

exp: process "" @ 10,10 150x125
expTitle: text "Export this page" @ 14,13 70x9
expFmt: dropdown "Format: Mermaid" @ 14,25 70x9
expName: field "diagram" @ 86,25 70x9
expText: textarea "flowchart LR\n  s1([Start]) --> s2[Step]\n  s2 --> s3{OK?}\n  s3 -- no --> s4[Retry]" @ 14,38 142x58
expNotes: text "Notes: anything this format can't carry" @ 14,99 142x8
expCopy: button "Copy" @ 62,113 28x10
expDown: button "Download" @ 92,113 34x10
expClose: button "Close" @ 128,113 28x10 [fill=#1F6F78 text=#FFFFFF]

imp: process "" @ 175,10 150x125
impTitle: text "Import a diagram" @ 179,13 70x9
impFmt: dropdown "Format: Detect automatically" @ 179,25 70x9
impDest: dropdown "Put it on: A new page" @ 251,25 70x9
impText: textarea "Paste Mermaid, PlantUML, DOT or draw.io text, or choose a file" @ 179,38 142x58
impNotes: text "Notes: what was understood, and what wasn't" @ 179,99 142x8
impFile: button "Choose file…" @ 179,113 34x10
impCancel: button "Cancel" @ 249,113 34x10
impGo: button "Import" @ 287,113 34x10 [fill=#1F6F78 text=#FFFFFF]

tour: tooltip "2 of 9 - Add a shape: click Process in the palette" @ 340,10 100x30
tourEnd: button "End tour" @ 340,44 32x10
tourNext: button "Next" @ 408,44 32x10 [fill=#1F6F78 text=#FFFFFF]

textTab: button "Text" @ 340,70 22x10
textTabNote: text "When the text pane is hidden, this tab on the stage's edge brings it back" @ 366,68 74x14

b8: badge "8" @ 150,12 8x6
b9: badge "9" @ 315,12 8x6
b10: badge "10" @ 442,4 10x6
b11: badge "11" @ 340,84 10x6

notes2: text "8 Export: the page as Mermaid, PlantUML, DOT, draw.io, PNG or PDF, previewed before it's saved\n9 Import: text or a file, onto a new page or this one; notes say what didn't come across\n10 Tour: nine steps over the real UI, most waiting until you've done them; runs by itself on a first visit, replayed from the toolbar\n11 Text tab: brings the text pane back when it's hidden" @ 10,145 430x30

page "3 Selection" size 305x232 direction LR

shp: process "" @ 10,10 85x175
shpTitle: text "Shape: process" @ 14,13 70x9
shpText: textarea "Step" @ 14,25 77x20
shpW: field "38" @ 14,49 37x9
shpH: field "13" @ 54,49 37x9
shpFill: dropdown "Fill" @ 14,62 77x9
shpLine: dropdown "Line" @ 14,74 77x9
shpTextCol: dropdown "Text colour" @ 14,86 77x9
shpWeight: dropdown "Line weight" @ 14,98 77x9
shpFront: button "Bring to front" @ 14,114 37x10
shpBack: button "Send to back" @ 54,114 37x10
shpDel: button "Delete" @ 14,128 77x10 [fill=#FBEAEA]

con: process "" @ 105,10 85x175
conTitle: text "Connection" @ 109,13 70x9
conType: dropdown "Type: Sequence" @ 109,25 77x9
conRoute: dropdown "Route: Elbow" @ 109,37 77x9
conLine: dropdown "Line: Solid" @ 109,49 77x9
conStart: dropdown "Start: None" @ 109,61 37x9
conEnd: dropdown "End: Arrow" @ 149,61 37x9
conMeans: field "Meaning shown in the key" @ 109,73 77x9
conRev: button "Reverse direction" @ 109,88 77x10
conDel: button "Delete" @ 109,102 77x10 [fill=#FBEAEA]

pic: process "" @ 200,10 85x95
picTitle: text "Image" @ 204,13 70x9
picChoose: button "Change picture…" @ 204,25 77x10
picNote: text "Pictures are stored in the .flow text as an icon, so the file stays one file" @ 204,40 77x24

b12: badge "12" @ 83,12 10x6
b13: badge "13" @ 178,12 10x6
b14: badge "14" @ 273,12 10x6

notes3: text "12 Shape: its text, size, colours and order; extra rows appear for tables, grids, charts and switches\n13 Connection: type, route and ends, and the meaning shown in the page's key\n14 Image: choose or change the picture" @ 10,195 280x22
```
