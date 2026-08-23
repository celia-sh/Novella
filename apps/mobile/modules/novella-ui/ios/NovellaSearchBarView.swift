import ExpoModulesCore
import UIKit

final class NovellaSearchBarView: ExpoView, UISearchBarDelegate {
  private let searchBar = UISearchBar(frame: .zero)

  let onQueryChange = EventDispatcher()
  let onSearch = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    searchBar.translatesAutoresizingMaskIntoConstraints = false
    searchBar.searchBarStyle = .minimal
    searchBar.autocapitalizationType = .none
    searchBar.autocorrectionType = .no
    searchBar.searchTextField.returnKeyType = .search
    searchBar.delegate = self

    addSubview(searchBar)
    NSLayoutConstraint.activate([
      // UISearchBar supplies its own 8 pt horizontal content inset. The React
      // list header already owns the page margin, so extend the native bar by
      // the same amount to align its search field with adjacent controls.
      searchBar.leadingAnchor.constraint(equalTo: leadingAnchor, constant: -8),
      searchBar.trailingAnchor.constraint(equalTo: trailingAnchor, constant: 8),
      searchBar.topAnchor.constraint(equalTo: topAnchor),
      searchBar.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
  }

  func setQuery(_ query: String) {
    // Native owns the active IME composition. A delayed JS prop update can be
    // older than the text currently held by UIKit; assigning it here would
    // clear markedTextRange and commit partial CJK pinyin (for example, "nih").
    guard searchBar.searchTextField.markedTextRange == nil else { return }
    guard searchBar.text != query else { return }
    searchBar.text = query
  }

  func setPlaceholder(_ placeholder: String?) {
    searchBar.placeholder = placeholder
  }

  func setEnabled(_ enabled: Bool) {
    searchBar.searchTextField.isEnabled = enabled
  }

  func focus() {
    searchBar.searchTextField.becomeFirstResponder()
  }

  func blur() {
    searchBar.searchTextField.resignFirstResponder()
  }

  func clear() {
    guard searchBar.text?.isEmpty == false else { return }
    searchBar.text = ""
    onQueryChange(["value": ""])
  }

  func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
    onQueryChange(["value": searchText])
  }

  func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
    let query = searchBar.text ?? ""
    onSearch(["value": query])
    searchBar.searchTextField.resignFirstResponder()
  }
}
