const nodesCallbacks = {
	'link[rel="designsheet"]' : (el, action) => {
		console.log(action + ' designsheet', el)
		// TODO : feed / update Design.Stack => On s'inspirera peut-être de Document.styleSheets (see https://developer.mozilla.org/fr/docs/Web/API/Document/styleSheets)
	},
	'body *[ref]' : (el, action) => {
		console.log(action + ' data binded element', el)
	},
	'body *[ref][editable-as]' : (el, action) => {	// + type or mimetype (the Editor Stack)
		console.log(action + ' each-item ref ', el)
	},
	'body *[ref] > itemset' : (el, action) => {
		console.log(action + ' itemset in data binded element', el)
	},
	'body *[group-ref]' : (el, action) => {
		console.log(action + ' group-ref ', el)
	},
	'body *[group-ref] *[ref]' : (el, action) => {
		console.log(action + ' group-ref ref ', el)
	},
	'body *[each-item]' : (el, action) => {
		console.log(action + ' each-item ', el)
	},
	'body *[each-item] *[ref]' : (el, action) => {	// Attention, ne doit on pas détourner les fonctions modifiant cet élémént? appendChild doit agir sur le definitionFragemntNode ?
		console.log(action + ' each-item ref ', el)
	},
	'template' : (el, action) => {
		// TODO : list and refresh all corresponding 'body *[renderby="ID"]'
		console.log(action + ' template ', el)
	},
	
	
	
	/* Changed demo here - Pas sûr d'en avoir besoin */
	'body *[ref] > itemset > item > value, body *[ref] > itemset > item > label' : (el, action, changedTarget, changedAction) => {
		console.log(action +' item in itemset in data binded element', el);
		console.log(el);
		if(changedTarget) {
			console.log(changedAction);
			console.log(changedTarget);
			console.log(el.textContent);
		}
	}
}

const attributesChangedCallbacks = {
	'ref' : (el, value) => {
		console.log('changed ref attribute', el, value)
	},
	'renderby' : (el, value) => {
		console.log('changed renderby attribute', el, value)
	},
	'shown' : (el, value) => {
		console.log('changed renderby attribute', el, value)
	}
}

var action = '', nodes = [], selectors = [];

// Create an observer instance linked to the callback function
const observer = new MutationObserver((mutationList, observer) => {
  mutationList.forEach((mutation) => {
    switch (mutation.type) {
      case "childList":
        /* One or more children have been added to and/or removed
           from the tree.
           (See mutation.addedNodes and mutation.removedNodes.) */
		   selectors = Object.keys(nodesCallbacks);
		   
		   // TODO : Ajout dynamic des callbacks à partir de Design.Stack
		   
           if(mutation.addedNodes.length) {
				action = 'add'
				nodes = mutation.addedNodes
			}
		   else {
				action = 'removed'
				nodes = mutation.removedNodes
			}
		   nodes.forEach(function(el) {
			    selectors.forEach(sel => {
					if(el.nodeType == 3 && el.parentNode.matches instanceof Function && el.parentNode.matches(sel))
						nodesCallbacks[sel](el.parentNode, 'changed', el, action);
					else if(el.matches instanceof Function && el.matches(sel))
						nodesCallbacks[sel](el, action);
				});
			})
        break;
      case "attributes":
        /* An attribute value changed on the element in
           mutation.target.
           The attribute name is in mutation.attributeName, and
           its previous value is in mutation.oldValue. */

           if(attributesChangedCallbacks[mutation.attributeName] instanceof Function)
				attributesChangedCallbacks[mutation.attributeName](mutation.target, mutation.target.getAttribute(mutation.attributeName))
        break;
    }
  })
});

// Start observing the target node for configured mutations
observer.observe(document, { attributes: true, childList: true, subtree: true });	// + attributeOldValue + characterData + characterDataOldValue
