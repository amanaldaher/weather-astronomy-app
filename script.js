// مفتاح الطقس ورابط الـ API
const apiKey = "0d01a2c35971b369a63fd825994ac586"; 
const apiUrl = "https://api.openweathermap.org/data/2.5/weather?units=metric&q=";

// عناصر الـ DOM
const selectView = document.getElementById("selectView");
const weatherView = document.getElementById("weatherView");
const countrySelect = document.getElementById("countrySelect");
const citySelect = document.getElementById("citySelect");
const getWeatherBtn = document.getElementById("getWeatherBtn");
const backBtn = document.getElementById("backBtn");
const weatherIcon = document.querySelector(".weather-icon");
const selectError = document.getElementById("selectError");

const locationTitle = document.getElementById("locationTitle");
const locationSubTitle = document.getElementById("locationSubTitle");
const weatherCondition = document.getElementById("weatherCondition");

// تحويل كود الدولة (ISO) إلى إيموجي علم الدولة 🚩
function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return "🌐";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

// تنظيف اسم المدينة من الأقواس والرموز لضمان قبولها في الـ API
function cleanCityName(name) {
    return name.split("(")[0].replace(/[\/\\#,+()$~%.'":*?<>{}]/g, "").trim();
}

// 1. جلب قائمة دول العالم فور فتح التطبيق 🌍
async function loadAllCountries() {
    try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries/iso");
        const data = await res.json();

        if (data.error) throw new Error("فشل جلب قائمة الدول");

        countrySelect.innerHTML = '<option value="" disabled selected>-- حدد الدولة / Select Country --</option>';

        // ترتيب الدول أبجدياً
        data.data.sort((a, b) => a.name.localeCompare(b.name));

        data.data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = JSON.stringify({ name: c.name, code: c.Iso2 });
            opt.textContent = `${c.name} ${getFlagEmoji(c.Iso2)}`;
            countrySelect.appendChild(opt);
        });

    } catch (err) {
        countrySelect.innerHTML = '<option value="" disabled selected>فشل تحميل الدول ❌</option>';
        selectError.style.display = "block";
    }
}

loadAllCountries();

// 2. جلب المدن التابعة للدولة المختارة 🏙️
countrySelect.addEventListener("change", async () => {
    const selectedCountry = JSON.parse(countrySelect.value);
    
    citySelect.disabled = true;
    citySelect.innerHTML = '<option value="" disabled selected>جاري جلب المدن... ⏳</option>';
    getWeatherBtn.disabled = true;

    try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: selectedCountry.name })
        });

        const data = await res.json();

        if (data.error || !data.data || !data.data.length) {
            citySelect.innerHTML = '<option value="" disabled selected>لا توجد مدن متوفرة لهذه الدولة</option>';
            return;
        }

        citySelect.innerHTML = '<option value="" disabled selected>-- اختر المدينة / Select City --</option>';
        citySelect.disabled = false;

        data.data.sort().forEach(city => {
            const opt = document.createElement("option");
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });

    } catch (err) {
        citySelect.innerHTML = '<option value="" disabled selected>تعذر جلب المدن ❌</option>';
    }
});

// 3. تفعيل زر العرض عند اختيار المدينة
citySelect.addEventListener("change", () => {
    if (citySelect.value) {
        getWeatherBtn.disabled = false;
    }
});

// 4. جلب وعرض بيانات الطقس والفلك مع حماية الخطأ 🌤️
async function fetchAndDisplayWeather(rawCityName, countryName, countryCode) {
    const cityName = cleanCityName(rawCityName);

    try {
        getWeatherBtn.textContent = "جاري التحميل... ⏳";
        getWeatherBtn.disabled = true;

        // طلب الطقس مع خطة بديلة (Fallback) في حال فشل الكود المزدوج
        let weatherRes = await fetch(`${apiUrl}${encodeURIComponent(cityName)},${countryCode}&appid=${apiKey}`);
        
        if (!weatherRes.ok) {
            weatherRes = await fetch(`${apiUrl}${encodeURIComponent(cityName)}&appid=${apiKey}`);
        }

        if (!weatherRes.ok) {
            throw new Error(`تعذر العثور على طقس هذه المدينة (${cityName})`);
        }

        const weatherData = await weatherRes.json();

        // طلب الفلك بشكل منفصل حتى لا يوقف عمل الطقس لو تعطل السيرفر
        let astroData = null;
        try {
            const astroRes = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}&method=4`);
            if (astroRes.ok) {
                astroData = await astroRes.json();
            }
        } catch (astroErr) {
            console.warn("بيانات الفلك غير متوفرة لهذه البلدة");
        }

        // تحديث الترويسة العلوية
        locationTitle.textContent = `${cityName}`;
        locationSubTitle.textContent = `${countryName} ${getFlagEmoji(countryCode)}`;

        // درجات الحرارة والرياح والرطوبة
        document.querySelector(".temp").textContent = Math.round(weatherData.main.temp) + "°c";
        document.querySelector(".humidity").textContent = weatherData.main.humidity + "%";
        document.querySelector(".wind").textContent = weatherData.wind.speed + " km/h";

        // أيقونة وحالة الطقس
        const condition = weatherData.weather[0].main;
        weatherCondition.textContent = weatherData.weather[0].description;

        if (condition === "Clouds") weatherIcon.src = "images/clouds.png";
        else if (condition === "Clear") weatherIcon.src = "images/clear.png";
        else if (condition === "Rain") weatherIcon.src = "images/rain.png";
        else if (condition === "Drizzle") weatherIcon.src = "images/drizzle.png";
        else if (condition === "Mist" || condition === "Haze" || condition === "Fog") weatherIcon.src = "images/mist.png";

        // تحديث الفلك ومرحلة القمر
        if (astroData && astroData.data) {
            const timings = astroData.data.timings;
            document.getElementById("sunriseTime").textContent = timings.Sunrise;
            document.getElementById("sunsetTime").textContent = timings.Sunset;

            const hijriDay = parseInt(astroData.data.date.hijri.day);
            let moonImage = "images/moon/55.jpg";
            let moonText = "بدر مكتمل (Full Moon)";

            if (hijriDay === 1 || hijriDay === 30) {
                moonImage = "images/moon/11.jpg";
                moonText = "محاق (New Moon)";
            } else if (hijriDay >= 2 && hijriDay <= 6) {
                moonImage = "images/moon/22.jpg";
                moonText = "هلال متزايد (Waxing Crescent)";
            } else if (hijriDay >= 7 && hijriDay <= 9) {
                moonImage = "images/moon/33.jpg";
                moonText = "تربيع أول (First Quarter)";
            } else if (hijriDay >= 10 && hijriDay <= 13) {
                moonImage = "images/moon/44.jpg";
                moonText = "أحدب متزايد (Waxing Gibbous)";
            } else if (hijriDay >= 14 && hijriDay <= 16) {
                moonImage = "images/moon/55.jpg";
                moonText = "بدر مكتمل (Full Moon)";
            } else if (hijriDay >= 17 && hijriDay <= 20) {
                moonImage = "images/moon/66.jpg";
                moonText = "أحدب متناقص (Waning Gibbous)";
            } else if (hijriDay >= 21 && hijriDay <= 23) {
                moonImage = "images/moon/77.jpg";
                moonText = "تربيع أخير (Last Quarter)";
            } else {
                moonImage = "images/moon/88.jpg";
                moonText = "هلال متناقص (Waning Crescent)";
            }

            document.getElementById("moonImg").src = moonImage;
            document.getElementById("moonPhaseText").textContent = moonText;
        } else {
            document.getElementById("sunriseTime").textContent = "--:--";
            document.getElementById("sunsetTime").textContent = "--:--";
            document.getElementById("moonPhaseText").textContent = "غير متوفر للبلدة";
        }

        // عرض شاشة الطقس وإخفاء شاشة الاختيار
        selectError.style.display = "none";
        selectView.classList.remove("active");
        weatherView.classList.add("active");

    } catch (err) {
        selectError.style.display = "block";
        console.error(err);
    } finally {
        getWeatherBtn.textContent = "عرض حالة الطقس 🍃";
        getWeatherBtn.disabled = false;
    }
}

// زر عرض الطقس
getWeatherBtn.addEventListener("click", () => {
    const selectedCountry = JSON.parse(countrySelect.value);
    const cityName = citySelect.value;

    fetchAndDisplayWeather(cityName, selectedCountry.name, selectedCountry.code);
});

// زر الرجوع لشاشة الاختيار
backBtn.addEventListener("click", () => {
    weatherView.classList.remove("active");
    selectView.classList.add("active");
});