# Namespace Contraction

For convenience (and for well known historical reasons), we will use the term XHTML to speak about HTML document rendered in the XML syntax format.
(see [https://html.spec.whatwg.org/multipage/xhtml.html](https://html.spec.whatwg.org/multipage/xhtml.html))

This is a mechanism that automatically
- transforms xml "prefixed:element" to html "prefixed-element"
- transforms xml namespaces prefixed declaration "xmlns:prefix" xml attributes to html "xmlns-prefix" attributes
- transforms xml default namespace declarations "xmlns" attribute to "xmlns-0"
- modify the default behaviour of DOM elements in a way that
  1. decrease complexity during the run time,
  2. increase compatibility between (non xml) html and its xml syntax

The document namespace contraction occurs immediatly after the DOM content is loaded.
If the browser does not support the namespace contraction, we can obtain a classical valid XHTML document with embeded XML elements
(that can be stylized with CSS with the old school method - see [https://developer.mozilla.org/en-US/docs/Web/CSS/@namespace](https://developer.mozilla.org/en-US/docs/Web/CSS/@namespace)) 

## Document methods

- `evaluate(exp, [node = document.documentElement], [NSResolver = null], [resultType = null], [result = null])`
This modified method allows us to evaluate XPath on XHTML document without having to deal with namespaces if NSResolver is null.
If you provide a NSResolver function, the evaluation will occured in a classical XML cloned document (with default prefixed:elements and xmlns:prefix definitions)

- `QueryXPath(exp)`
This new method returns the first element or the first result targeted by a given XPath expression

- `QueryXPathAll(exp)`
This new method returns the list of nodes targeted by a given XPath expression

## Element methods and properties

- `QueryXPath(exp)`
This new method returns the first element or the first result targeted by a given XPath expression

- `QueryXPathAll(exp)`
This new method returns the list of nodes targeted by a given XPath expression

- `innerHTML.set` This modified property improve compatibility between XHTML and HTML. The setter will first try to interpret the given string as XHTML.
If it fails, it will test if it is a valid HTML content, then convert it to be a valid XHTML content and display a warning in the console:
"Valid HTML, but invalid XML. Automatically corrected for compatibility reasons."
Or display an error if it is not a valid HTML nor a valid XHTML content.


- `intricatedXML` <=> `intricatedHTML`
This read-only property will return the corresponding prefixed:element of an prefixed-element. The given element provide a read-only
property "intricatedHTML" to retrieve the original element.

- `innerXML.get`
This property getter will return the (native) innerHTML of the intricatedXML element.

- `innerXML.set`This property will set the (native) innerHTML content of the intricated element from the virtual classical XML DOM, and will update the
real XHTML DOM after performing the namespace contraction on the result.


- `outerXML.get`
This read-only property will return the (native) outerHTML of the intricatedXML element.

- `DOMPath` This will return a selector that allow us to fetch exactly the element. Note that the intricated element will have exactly the same property value.
You can retrieve the element from the real contracted XHTML DOM, or the intricated element from the virtual classical XML DOM, with the same DOMPath selector.

- `rootNode`
Will returns the root element of the element's connected tree. Generally the documentElement `<html />`

- `namespaceURI` This modified read-only property returns the namespace URI of the element.
Note that contrary to the classical behavior, this IS a computed value that is the result of a namespace lookup based on an examination of
the namespace declarations in scope. (see [https://developer.mozilla.org/en-US/docs/Web/API/Element/namespaceURI](https://developer.mozilla.org/en-US/docs/Web/API/Element/namespaceURI))
And this will work on the prefixed-element provided by the namespace contraction mechanism.
