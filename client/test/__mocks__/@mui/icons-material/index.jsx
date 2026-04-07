// Mock для всех MUI иконок
const createIconMock = (name) => {
  const IconMock = (props) => {
    return <span data-testid={`icon-${name}`} {...props} />
  }
  IconMock.displayName = name
  return IconMock
}

// Экспортируем все иконки динамически
const icons = [
  'GitHub', 'YouTube', 'Telegram', 'Brightness7', 'Brightness4', 'BrightnessAuto',
  'Logout', 'HelpOutline', 'Menu', 'People', 'Settings', 'Dns', 'SwapHoriz',
  'Delete', 'Add', 'Terminal', 'CheckCircle', 'Error', 'LinkIcon', 'OpenInNew',
  'ContentCopy', 'Router', 'Edit', 'MoreVert', 'Remove', 'Refresh', 'Search',
  'FilterList', 'RefreshTwoTone', 'Warning', 'Info', 'Close', 'Check',
  'ArrowDownward', 'ArrowUpward', 'MoreHoriz', 'ContentPaste', 'QrCode', 'Usb',
  'VpnKey', 'Security', 'Speed', 'Timeline', 'Assessment', 'SettingsApplications',
  'CloudDownload', 'CloudUpload', 'Folder', 'FileCopy', 'Save', 'Print',
  'DeleteOutline', 'Restore', 'History', 'Schedule', 'AccessTime', 'Today',
  'Event', 'Notifications', 'AccountCircle', 'Person', 'Group', 'Public',
  'Language', 'Translate', 'Star', 'Favorite', 'Home', 'LocationOn', 'Place',
  'Email', 'Phone', 'Chat', 'Message', 'Forum', 'Share', 'Send', 'Inbox',
  'Drafts', 'Mail', 'Markunread', 'Lock', 'LockOpen', 'Unlock', 'Visibility',
  'VisibilityOff', 'Eye', 'EyeOff', 'ToggleOn', 'ToggleOff', 'RadioButtonChecked',
  'RadioButtonUnchecked', 'CheckBox', 'CheckBoxOutlineBlank', 'IndeterminateCheckBox',
  'PlusOne', 'ThumbUp', 'ThumbDown', 'Whatshot', 'FavoriteBorder', 'StarBorder',
  'Bookmark', 'BookmarkBorder', 'Bookmarks', 'TurnedIn', 'TurnedInNot', 'Label',
  'LabelImportant', 'Grade', 'Done', 'Clear', 'Block', 'Ban', 'Stop', 'Pause',
  'PlayArrow', 'FastForward', 'FastRewind', 'SkipNext', 'SkipPrevious',
  'FiberManualRecord', 'Circle', 'Square', 'Rectangle', 'Triangle', 'NavigateNext',
  'NavigateBefore', 'ChevronRight', 'ChevronLeft', 'ExpandMore', 'ExpandLess',
  'UnfoldMore', 'UnfoldLess', 'ArrowRight', 'ArrowLeft', 'ArrowBack', 'ArrowForward',
  'ArrowDropDown', 'ArrowDropUp', 'Expand', 'SubdirectoryArrowRight',
  'SubdirectoryArrowLeft', 'FileDownload', 'FileUpload', 'Attachment', 'Link',
  'InsertLink', 'Photo', 'Image', 'PictureAsPdf', 'ImageIcon', 'CameraAlt',
  'Videocam', 'Movie', 'MusicNote', 'Mic', 'VolumeUp', 'VolumeOff', 'Headset',
  'Headphones', 'Speaker', 'Radio', 'Podcasts', 'Tv', 'DesktopWindows', 'Laptop',
  'Computer', 'Tablet', 'Smartphone', 'PhoneIphone', 'PhoneAndroid', 'Devices',
  'SmartDisplay', 'Monitor', 'ScreenShare', 'StopScreenShare', 'PresentToAll',
  'Cast', 'CastConnected', 'CastForEducation', 'Wifi', 'WifiOff', 'NetworkWifi',
  'NetworkCell', 'SignalCellular4Bar', 'SignalWifi4Bar', 'Bluetooth',
  'BluetoothConnected', 'BluetoothDisabled', 'GpsFixed', 'GpsNotFixed',
  'LocationSearching', 'MyLocation', 'Navigation', 'NearMe', 'Directions',
  'DirectionsCar', 'DirectionsBus', 'DirectionsTrain', 'DirectionsBike',
  'DirectionsWalk', 'DirectionsRun', 'Flight', 'LocalAirport', 'Hotel',
  'Restaurant', 'LocalCafe', 'LocalBar', 'LocalPizza', 'BrunchDining',
  'DinnerDining', 'LunchDining', 'Nightlife', 'LocalHospital', 'LocalPharmacy',
  'ShoppingBag', 'ShoppingCart', 'ShoppingBasket', 'Store', 'Shop', 'Storefront',
  'LocalMall', 'AccountBalance', 'Business', 'CorporateFare', 'Work',
  'MeetingRoom', 'Gite', 'House', 'Cottage', 'Apartment', 'Villa', 'OtherHouses',
  'Foundation', 'Fence', 'Yard', 'Pool', 'HotTub', 'Spa', 'FitnessCenter',
  'SportsGymnasium', 'SportsBasketball', 'SportsFootball', 'SportsSoccer',
  'SportsTennis', 'SportsVolleyball', 'SportsBaseball', 'SportsCricket',
  'SportsGolf', 'SportsHockey', 'SportsMma', 'SportsMotorsports', 'SportsRugby',
  'SportsScore', 'SportsHandball', 'SportsKabaddi', 'Rowing', 'Surfing',
  'Kitesurfing', 'Snowboarding', 'DownhillSkiing', 'Snowshoeing', 'IceSkating',
  'Curling', 'Sailing', 'Kayaking', 'Rafting', 'ScubaDiving', 'Diving', 'Fishing',
  'Hiking', 'RunningWithErrors', 'PlayCircleFilled', 'PauseCircleFilled',
  'CheckCircle', 'Dns'
]

// Создаем экспорт для каждой иконки
const exportsObj = {}
icons.forEach(name => {
  exportsObj[name] = createIconMock(name)
})

module.exports = exportsObj
module.exports.default = createIconMock('DefaultIcon')
