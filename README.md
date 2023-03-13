# html-dynamic-extensions
Declarative Dynamic Extensions to HTML (dde2html)

See description here : https://flavi1.github.io/html-dynamic-extensions/

# Proof of Concept
Let's start here an experimental JS implementation.
As a paradox, our fully unobstrusive JS dde2html implementation will be written in JS.

## Syntax problematics

### Html parser problems

- We need to integrate XML in the head section to allow model instance elements to content XML. Which is likely to break the html parser. A possible later implementation fix is to embed model and instance elements in a script.

- Actually, templates tag content are interpreted as html fragment, not as text content (like textarea and script tags does) which is a big limitation.
However it is likely to change (see https://github.com/whatwg/html/issues/2254). But it will subsit a problem. For browsers that don't support it, we may envisage a way to fallback by using script tags instead of templates tags.

In a first time, we have to temporarly use the XML syntax to avoid these problems. But...

### XML limitations

I was hoping to find a way to attach shadow DOM to prefixed:xml_element but it is actually impossible.
I posted an issue to wathwg/html, but it was rejected (https://github.com/whatwg/html/issues/9013).

As a paradox, to avoid this problem, the Declarative Dynamic DOM will transform all prefixed:xml_element to prefixed-xml_element.
Then, these will be parsed as custom elements (yes, exactly the technology we are hopping to depreciate, we will use it to fix our problems), allowing us to attach a shadow dom on these elements.

Surprisingly, this fix automatically solves others complex problems related to CSS selectors and querySelector from the selectors API. It s very hard to use xml elements with the selectors (see https://stackoverflow.com/questions/23034283/is-it-possible-to-use-htmls-queryselector-to-select-by-xlink-attribute-in-an#23047888).

So it's finally an happy accident, and that's why this fix become the prefered way of integrating XML in dde2html documents.

### But, does this mean we will use XML syntax without XML syntax?
Yes, somehow. Since xml:element fallback to xml-element. But the XML syntax gives us the closing tag flexibility. So this is not a problem. Just a translation.

### Ok, but how do the browser will interpret my svg:svg xml elements for example?
You're right to ask for it. Since we don't use the html parser, SVG is not integrated anymore and we have to provide it with a namespace. But it is transformed to svg-svg, so you naturally think that the browser will not render it as expected.

Don't be afraid, the xml-element rewriting does not concern the shadow dom inner contents. The design layer will be able to handle this element, and to provide its right representation by putting it in an old school classical xml wrapper!
Moreover, for SVG, it will be provided in the default design system asset of dde2html. So it will be transparent for you.

### I know that this project aims to be a Custom Elements replacement. But what if I still want to use custom elements?
When you define your xml namespaces, just ensure that there is no collisions with the custom elements you want to use.

# Conclusion
I was hoping dde2html to be mergeable to html, but I released this not an imperative at all, and it's not possible for now, probably forever.
And it's not realistic to try forcing whatwg/html to follow my needs. So ok, I will take another way.
XML syntax is more constraining than HTML syntax. But the XML syntax is again more flexible than HTML syntax making us happy to use it without having to take care about parser problems. Moreover, we resolve partially the XML syntax complexity by transform xml:elements to xml-elements, and then pushing the xml ns complexity in the design layer.

Then we will never be concerned about parser fossilization problematics choosing the XML syntax.
The only price to paid is to not forgot to close tags and to encapsulate templates and script contents.

So this project can be considered as a kind of XHTML revival.
This should not make us forget that dde2html should be as compatible as possible with html.
We have to carrefully avoid possible collisions with html.
Keep in mind that the goal of this project is to drastically decrease web complexity.

Let's ready to start developping the proof of concept implementation.
