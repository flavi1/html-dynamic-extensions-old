// Create an observer instance linked to the callback function
const observer = new MutationObserver((mutationList, observer) => {
  mutationList.forEach((mutation) => {
    switch (mutation.type) {
      case "childList":
        /* One or more children have been added to and/or removed
           from the tree.
           (See mutation.addedNodes and mutation.removedNodes.) */
           console.log("A child node has been added ...");
           console.log(mutation.addedNodes);
           console.log("or removed.");
           console.log(mutation.addedNodes);
        break;
      case "attributes":
        /* An attribute value changed on the element in
           mutation.target.
           The attribute name is in mutation.attributeName, and
           its previous value is in mutation.oldValue. */
           console.log(`The ${mutation.attributeName} attribute was modified.`);
           console.log(`Previous value was ${mutation.attributeName}.`);
        break;
    }
  });

// Start observing the target node for configured mutations
observer.observe(document, { attributes: true, childList: true, subtree: true });
