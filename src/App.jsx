import { useEffect, useMemo, useState } from 'react'
import './App.css'

const DADATA_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/metro'
const DADATA_TOKEN = 'b60fad306dd4a03e6da8ac37da276682bd70fa1b'

const CATEGORY_LIST = [
  { id: 'seat', label: 'Сиденье', icon: '🪑' },
  { id: 'handrail', label: 'Поручень', icon: '🪜' },
  { id: 'wall', label: 'Стена / дверь', icon: '🚪' },
  { id: 'floor', label: 'Пол', icon: '🧱' },
  { id: 'graffiti', label: 'Граффити', icon: '🎨' },
  { id: 'glass', label: 'Стекло', icon: '🪟' },
  { id: 'light', label: 'Освещение', icon: '💡' },
  { id: 'other', label: 'Другое', icon: '⋯' },
]

function haversineDistanceKm(a, b) {
  if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null)
    return null

  const R = 6371 // km
  const toRad = (v) => (v * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2),
      ),
      Math.sqrt(
        1 -
          (sinDLat * sinDLat +
            sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2)),
      ),
    )

  return R * c
}

function App() {
  const [screen, setScreen] = useState('welcome')

  const [photos, setPhotos] = useState([]) // { id, file, url }
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [description, setDescription] = useState('')

  const [metroQuery, setMetroQuery] = useState('')
  const [metroSuggestions, setMetroSuggestions] = useState([])
  const [selectedMetro, setSelectedMetro] = useState(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [nearestStations, setNearestStations] = useState([])
  const [hasLoadedNearest, setHasLoadedNearest] = useState(false)

  const [userLocation, setUserLocation] = useState(null)
  const [geoStatus, setGeoStatus] = useState('Определяем местоположение…')

  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('neutral') // 'neutral' | 'success' | 'error'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dialog, setDialog] = useState({
    open: false,
    type: 'loading', // 'loading' | 'success' | 'error'
    reports: [],
    error: '',
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Геолокация недоступна в этом браузере')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }
        setUserLocation(coords)
        setGeoStatus('Местоположение определено')
      },
      () => {
        setGeoStatus('Не удалось определить геолокацию')
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      },
    )
  }, [])

  useEffect(() => {
    if (!metroQuery.trim()) {
      setMetroSuggestions([])
      setSuggestionsError('')
      setShowSuggestions(false)
      return
    }

    setIsLoadingSuggestions(true)
    setSuggestionsError('')
    setShowSuggestions(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(DADATA_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Token ' + DADATA_TOKEN,
          },
          body: JSON.stringify({
            query: metroQuery.trim(),
            filters: [{ city: 'Москва' }],
            count: 12,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Не удалось получить станции метро')
        }

        const json = await response.json()
        const suggestions = (json?.suggestions || []).map((item) => {
          const lat = item.data?.geo_lat ? parseFloat(item.data.geo_lat) : null
          const lon = item.data?.geo_lon ? parseFloat(item.data.geo_lon) : null
          const lineColor = item.data?.color
            ? `#${item.data.color}`
            : null
          const base = {
            value: item.value,
            name: item.data?.name || item.value,
            lineName: item.data?.line_name || '',
            city: item.data?.city || '',
            lat,
            lon,
            lineColor,
            distanceKm: null,
          }

          if (userLocation && lat != null && lon != null) {
            base.distanceKm = haversineDistanceKm(userLocation, { lat, lon })
          }

          return base
        })

        suggestions.sort((a, b) => {
          const da = a.distanceKm ?? Number.POSITIVE_INFINITY
          const db = b.distanceKm ?? Number.POSITIVE_INFINITY
          if (da === db) return a.name.localeCompare(b.name, 'ru')
          return da - db
        })

        setMetroSuggestions(suggestions)
      } catch (error) {
        if (error.name === 'AbortError') return
        setSuggestionsError('Ошибка при загрузке станций метро')
        setMetroSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    }, 350)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [metroQuery, userLocation])

  useEffect(() => {
    if (!userLocation || hasLoadedNearest) return

    const controller = new AbortController()

    ;(async () => {
      try {
        const response = await fetch(DADATA_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Token ' + DADATA_TOKEN,
          },
          body: JSON.stringify({
            query: 'а',
            filters: [{ city: 'Москва' }],
            count: 50,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Не удалось получить станции метро')
        }

        const json = await response.json()
        const items = (json?.suggestions || []).map((item) => {
          const lat = item.data?.geo_lat ? parseFloat(item.data.geo_lat) : null
          const lon = item.data?.geo_lon ? parseFloat(item.data.geo_lon) : null
          const lineColor = item.data?.color
            ? `#${item.data.color}`
            : null

          const result = {
            value: item.value,
            name: item.data?.name || item.value,
            lineName: item.data?.line_name || '',
            city: item.data?.city || '',
            lat,
            lon,
            lineColor,
            distanceKm: null,
          }

          if (userLocation && lat != null && lon != null) {
            result.distanceKm = haversineDistanceKm(userLocation, { lat, lon })
          }

          return result
        })

        const nearest = items
          .filter((s) => s.distanceKm != null)
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 6)

        setNearestStations(nearest)
        setHasLoadedNearest(true)
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    })()

    return () => controller.abort()
  }, [userLocation, hasLoadedNearest])

  const selectedCategory = useMemo(
    () =>
      CATEGORY_LIST.find((item) => item.id === selectedCategoryId) ?? null,
    [selectedCategoryId],
  )

  function resetForm() {
    setPhotos((prev) => {
      prev.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url)
      })
      return []
    })
    setSelectedCategoryId(null)
    setDescription('')
    setMetroQuery('')
    setMetroSuggestions([])
    setSelectedMetro(null)
    setStatusMessage('')
    setStatusType('neutral')
    setIsSubmitting(false)
    setSuggestionsError('')
    setShowSuggestions(false)
  }

  function handleStartReport() {
    setScreen('report')
  }

  function handleBack() {
    resetForm()
    setScreen('welcome')
  }

  function handlePhotoChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const MAX_PHOTOS = 6

    setPhotos((prev) => {
      const remainingSlots = Math.max(0, MAX_PHOTOS - prev.length)
      const toAdd = files.slice(0, remainingSlots)

      const newItems = toAdd.map((file, index) => ({
        id:
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p_${Date.now()}_${index}`),
        file,
        url: URL.createObjectURL(file),
      }))

      return [...prev, ...newItems]
    })

    event.target.value = ''
  }

  function handleRemovePhoto(id) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.url) {
        URL.revokeObjectURL(target.url)
      }
      return prev.filter((p) => p.id !== id)
    })
  }

  function validateForm() {
    const errors = []

    if (!photos.length) {
      errors.push('добавьте хотя бы одну фотографию')
    }
    if (!selectedCategory) {
      errors.push('выберите тип дефекта')
    }
    if (!selectedMetro) {
      errors.push('выберите станцию метро')
    }

    if (errors.length) {
      setStatusMessage('Проверьте форму: ' + errors.join(', ') + '.')
      setStatusType('error')
      return false
    }

    setStatusMessage('')
    setStatusType('neutral')
    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setStatusMessage('')
    setStatusType('neutral')
    setDialog({
      open: true,
      type: 'loading',
      reports: [],
      error: '',
    })

    const categoryValue = selectedCategory?.label || ''
    const stationValue = selectedMetro?.name || metroQuery.trim()

    const latitude =
      userLocation?.lat ??
      selectedMetro?.lat ??
      ''
    const longitude =
      userLocation?.lon ??
      selectedMetro?.lon ??
      ''

    const formData = new FormData()
    formData.append('category', categoryValue)
    formData.append('station', stationValue)
    formData.append('description', description.trim())
    formData.append('latitude', latitude !== '' ? String(latitude) : '')
    formData.append('longitude', longitude !== '' ? String(longitude) : '')
    photos.forEach((p) => {
      formData.append('files', p.file)
    })

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/reports/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Код ответа: ${response.status}`)
      }

      const json = await response.json()
      const reports = Array.isArray(json) ? json : [json]

      setDialog({
        open: true,
        type: 'success',
        reports,
        error: '',
      })
      setStatusMessage('Спасибо! Дефект отправлен в систему.')
      setStatusType('success')
      resetForm()
    } catch (error) {
      setDialog({
        open: true,
        type: 'error',
        reports: [],
        error:
          'Не удалось отправить данные. Попробуйте ещё раз. ' +
          (error?.message || ''),
      })
      setStatusMessage('Ошибка отправки. Проверьте подключение к сети.')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSelectSuggestion(suggestion) {
    setSelectedMetro(suggestion)
    setMetroQuery(
      suggestion.name +
        (suggestion.lineName ? ` — ${suggestion.lineName}` : ''),
    )
    setShowSuggestions(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-mark">М</div>
        <div className="logo-text">
          <div className="logo-title">МетроАй</div>
          <div className="logo-subtitle">
            Краудсорсинг дефектов вагонов метро
          </div>
        </div>
      </header>

      <main className="app-main">
        {screen === 'welcome' && (
          <section className="screen screen--active">
            <div className="card card--center">
              <h1 className="headline">
                Помогите сделать метро чище и безопаснее
              </h1>
              <p className="subtitle">
                Займёт меньше минуты: сделайте фото дефекта в вагоне и отправьте
                его в общую базу для обучения нейросети.
              </p>
              <button
                className="btn btn-primary btn-primary--large"
                type="button"
                onClick={handleStartReport}
              >
                Сообщить о дефекте
              </button>
            </div>
          </section>
        )}

        {screen === 'report' && (
          <section className="screen screen--active">
            <button
              className="link-back"
              type="button"
              onClick={handleBack}
            >
              ← Назад
            </button>

            <form className="card" onSubmit={handleSubmit}>
              <h2 className="section-title">Сообщение о дефекте</h2>

              <div className="form-group">
                <label className="field-label">
                  Фотографии дефекта<span className="required">*</span>
                </label>
                <input
                  id="photo-input"
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoChange}
                />
                <label htmlFor="photo-input" className="photo-upload">
                  <div className="photo-icon">📷</div>
                  <div className="photo-text-main">
                    {photos.length
                      ? 'Добавить ещё фотографий'
                      : 'Сделать фотографии или выбрать из галереи'}
                  </div>
                  <div className="photo-text-sub">
                    Можно добавить несколько чётких фото дефекта
                  </div>
                </label>
                <div className="photo-status">
                  {photos.length
                    ? `Фотографий: ${photos.length}`
                    : ''}
                </div>
                {!!photos.length && (
                  <div className="photos-grid">
                    {photos.map((photo) => (
                      <div className="photo-thumb" key={photo.id}>
                        <img src={photo.url} alt="Фото дефекта" />
                        <button
                          type="button"
                          className="photo-remove"
                          onClick={() => handleRemovePhoto(photo.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="field-label">
                  Тип дефекта<span className="required">*</span>
                </label>
                <div className="category-grid">
                  {CATEGORY_LIST.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={
                        'category-card' +
                        (selectedCategoryId === category.id
                          ? ' category-card--selected'
                          : '')
                      }
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      <div className="category-icon">{category.icon}</div>
                      <div className="category-label">{category.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="description">
                  Краткое описание
                </label>
                <textarea
                  id="description"
                  className="text-input text-input--multiline"
                  rows={3}
                  placeholder="Например: рваное сиденье у окна, трещина на стекле двери, отломан поручень..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="metro-search">
                  Линия / станция метро (Москва)
                  <span className="required">*</span>
                </label>
                <div className="metro-search">
                  <input
                    id="metro-search"
                    type="search"
                    autoComplete="off"
                    className="text-input metro-input"
                    placeholder="Например: Комсомольская, Тверская, Парк культуры..."
                    value={metroQuery}
                    onChange={(e) => {
                      setMetroQuery(e.target.value)
                      setSelectedMetro(null)
                    }}
                    onFocus={() => {
                      if (metroSuggestions.length) {
                        setShowSuggestions(true)
                      }
                    }}
                  />
                  {selectedMetro && (
                    <div className="metro-input-badge" aria-hidden="true">
                      <span
                        className="metro-line-color-dot"
                        style={{
                          backgroundColor:
                            selectedMetro.lineColor || '#9ca3af',
                        }}
                      />
                      <span className="metro-input-badge-text">
                        {selectedMetro.lineName || 'Линия не указана'}
                      </span>
                    </div>
                  )}
                  {userLocation && (
                    <div className="metro-geo-status metro-geo-status--ok">
                      📍 {geoStatus}
                    </div>
                  )}
                  {!userLocation && geoStatus && (
                    <div className="metro-geo-status">{geoStatus}</div>
                  )}

                  {showSuggestions && (
                    <div className="metro-suggestions">
                      {isLoadingSuggestions && (
                        <div className="metro-suggestion metro-suggestion--meta">
                          Загружаем станции…
                        </div>
                      )}

                      {suggestionsError && !isLoadingSuggestions && (
                        <div className="metro-suggestion metro-suggestion--meta metro-suggestion--error">
                          {suggestionsError}
                        </div>
                      )}

                      {!isLoadingSuggestions &&
                        !suggestionsError &&
                        !metroSuggestions.length && (
                          <div className="metro-suggestion metro-suggestion--meta">
                            Ничего не найдено
                          </div>
                        )}

                      {!isLoadingSuggestions &&
                        !suggestionsError &&
                        metroSuggestions.map((sugg) => (
                          <button
                            key={`${sugg.name}-${sugg.lineName}-${sugg.lat}-${sugg.lon}`}
                            type="button"
                            className="metro-suggestion"
                            onClick={() => handleSelectSuggestion(sugg)}
                          >
                            <div className="metro-suggestion-main">
                              <span className="metro-suggestion-name">
                                {sugg.name}
                              </span>
                              {sugg.distanceKm != null && (
                                <span className="metro-suggestion-distance">
                                  {(sugg.distanceKm < 1
                                    ? sugg.distanceKm * 1000
                                    : sugg.distanceKm
                                  ).toFixed(sugg.distanceKm < 1 ? 0 : 1)}{' '}
                                  {sugg.distanceKm < 1 ? 'м' : 'км'}
                                </span>
                              )}
                            </div>
                            <div className="metro-suggestion-sub">
                              <span
                                className="metro-line-color-dot"
                                style={{
                                  backgroundColor:
                                    sugg.lineColor || '#9ca3af',
                                }}
                              />
                              <span>
                                {sugg.lineName || 'Линия не указана'}
                                {sugg.city ? ` • ${sugg.city}` : ''}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {nearestStations.length > 0 && (
                    <div className="metro-nearest-list">
                      <div className="metro-nearest-title">
                        Станции рядом:
                      </div>
                      <div className="metro-nearest-chips">
                        {nearestStations.map((st) => (
                          <button
                            key={`${st.name}-${st.lineName}-${st.lat}-${st.lon}`}
                            type="button"
                            className="metro-nearest-chip"
                            onClick={() => handleSelectSuggestion(st)}
                          >
                            <span
                              className="metro-nearest-color"
                              style={{
                                backgroundColor: st.lineColor || '#9ca3af',
                              }}
                            />
                            <span className="metro-nearest-name">
                              {st.name}
                            </span>
                            {st.distanceKm != null && (
                              <span className="metro-nearest-distance">
                                {st.distanceKm < 1
                                  ? `${(st.distanceKm * 1000).toFixed(0)} м`
                                  : `${st.distanceKm.toFixed(1)} км`}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={
                  'status-line ' +
                  (statusType === 'success'
                    ? 'status-line--success'
                    : statusType === 'error'
                      ? 'status-line--error'
                      : '')
                }
              >
                {statusMessage}
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Отправляем…' : 'Отправить'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      {dialog.open && (
        <div className="dialog-backdrop">
          <div className="dialog-card">
            {dialog.type === 'loading' && (
              <>
                <div className="dialog-title">Отправляем данные…</div>
                <div className="dialog-body">
                  <div className="spinner" />
                  <p>Это займёт всего несколько секунд.</p>
                </div>
              </>
            )}

            {dialog.type === 'success' && (
              <>
                <div className="dialog-title">Ваши данные отправлены</div>
                <div className="dialog-body">
                  <p className="dialog-body-text">
                    Отчёт успешно создан. Краткая информация по загруженным
                    фото:
                  </p>
                  <div className="reports-list">
                    {dialog.reports.map((report) => (
                      <div className="report-item" key={report.id}>
                        <div className="report-row">
                          <span className="report-label">ID</span>
                          <span className="report-value">{report.id}</span>
                        </div>
                        <div className="report-row">
                          <span className="report-label">Категория</span>
                          <span className="report-value">
                            {report.category}
                          </span>
                        </div>
                        <div className="report-row">
                          <span className="report-label">Станция</span>
                          <span className="report-value">
                            {report.station}
                          </span>
                        </div>
                        <div className="report-row">
                          <span className="report-label">Статус</span>
                          <span className="report-value">
                            {report.status}
                          </span>
                        </div>
                        {report.photo_url && (
                          <div className="report-row">
                            <span className="report-label">Фото</span>
                            <span className="report-value report-value--mono">
                              {report.photo_url}
                            </span>
                          </div>
                        )}
                        {report.created_at && (
                          <div className="report-row">
                            <span className="report-label">Создано</span>
                            <span className="report-value">
                              {new Date(
                                report.created_at,
                              ).toLocaleString('ru-RU')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setDialog((prev) => ({ ...prev, open: false }))
                    }
                  >
                    Понятно
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'error' && (
              <>
                <div className="dialog-title">Не удалось отправить</div>
                <div className="dialog-body">
                  <p className="dialog-body-text">{dialog.error}</p>
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setDialog((prev) => ({ ...prev, open: false }))
                    }
                  >
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>МетроАй</span>
        <span className="dot">•</span>
        <span>Хакатон: краудсорсинг и робот для инспекции вагонов</span>
      </footer>
    </div>
  )
}

export default App

