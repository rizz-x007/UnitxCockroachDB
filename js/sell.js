document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("unithrift_session_token");
    if (!token) { window.location.href = '/'; return; }

    // ======================================
    // IMAGE PREVIEW
    // ======================================
    const imageInput = document.getElementById("productImages");
    const previewContainer = document.getElementById("previewContainer");

    imageInput.addEventListener("change", () => {
        previewContainer.innerHTML = "";
        Array.from(imageInput.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.style.cssText = "width:100px;height:100px;object-fit:cover;border-radius:8px;margin:4px;";
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });

    // ======================================
    // UNIVERSITY AUTOCOMPLETE LOGIC
    // ======================================
    const collegeName = document.getElementById("collegeName");
    const sellCampusDropdown = document.getElementById("sellCampusDropdown");

    const savedUni = localStorage.getItem("unithrift_selected_university");
    if (savedUni && collegeName) {
        collegeName.value = savedUni;
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    (function setupSellUniversitySearch() {
        if (!collegeName || !sellCampusDropdown) return;
        
        let debounceTimer = null;
        let currentResults = [];
        let activeIndex = -1;

        function closeDropdown() {
            sellCampusDropdown.style.display = "none";
            sellCampusDropdown.innerHTML = "";
            currentResults = [];
            activeIndex = -1;
        }

        function renderResults(results) {
            currentResults = results;
            activeIndex = -1;

            if (results.length === 0) {
                sellCampusDropdown.innerHTML = `<div style="padding: 10px; font-size: 0.8rem; color: #8e939e;">No universities found</div>`;
                sellCampusDropdown.style.display = "block";
                return;
            }

            sellCampusDropdown.innerHTML = results.map((r, i) => `
                <div class="campus-suggestion" data-index="${i}" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 10px;
                    border-radius: 6px;
                    font-size: 0.82rem;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    color: var(--text);
                ">
                    <i class="fas fa-graduation-cap" style="color: var(--accent, #6366f1);"></i>
                    <span class="suggestion-text"></span>
                </div>
            `).join("");

            sellCampusDropdown.querySelectorAll(".campus-suggestion").forEach((el, i) => {
                el.querySelector(".suggestion-text").textContent = results[i].formatted;
                el.addEventListener("click", () => selectResult(results[i]));
                el.addEventListener("mouseenter", () => highlight(i));
            });

            sellCampusDropdown.style.display = "block";
        }

        function highlight(index) {
            activeIndex = index;
            sellCampusDropdown.querySelectorAll(".campus-suggestion").forEach((el, i) => {
                if (i === index) {
                    el.style.background = "rgba(99, 102, 241, 0.15)";
                } else {
                    el.style.background = "transparent";
                }
            });
        }

        function selectResult(result) {
            if (!result) return;
            collegeName.value = result.formatted;
            closeDropdown();
        }

        collegeName.addEventListener("input", () => {
            const query = collegeName.value.trim();
            clearTimeout(debounceTimer);

            if (query.length < 3) {
                closeDropdown();
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const resp = await fetch(`/api/geoapify/autocomplete?text=${encodeURIComponent(query)}&type=amenity`);
                    const data = await resp.json();
                    if (!data.success) return closeDropdown();
                    renderResults(data.results || []);
                } catch (err) {
                    console.error("University autocomplete failed:", err);
                    closeDropdown();
                }
            }, 300);
        });

        collegeName.addEventListener("keydown", (e) => {
            if (sellCampusDropdown.style.display === "none" || currentResults.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
                highlight(activeIndex);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                highlight(activeIndex);
            } else if (e.key === "Enter") {
                e.preventDefault();
                selectResult(currentResults[activeIndex >= 0 ? activeIndex : 0]);
            } else if (e.key === "Escape") {
                closeDropdown();
            }
        });

        document.addEventListener("click", (e) => {
            if (e.target !== collegeName && !sellCampusDropdown.contains(e.target)) closeDropdown();
        });
    })();

    // ======================================
    // FORM SUBMIT → UPLOAD IMAGES → CREATE LISTING
    // ======================================
    const sellForm = document.getElementById("sellForm");
    const verificationStatus = document.getElementById("verificationStatus");

    sellForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = sellForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-robot"></i> AI Verifying... Please wait.';
        verificationStatus.textContent = "Analyzing files and matching product characteristics...";

        const title           = document.getElementById("title").value.trim();
        const category        = document.getElementById("category").value;
        const price           = document.getElementById("price").value;
        const condition       = document.getElementById("condition").value;
        const description     = document.getElementById("description").value.trim();
        const college_name    = collegeName.value.trim();
        const contactNo       = document.getElementById("contactNo").value.trim();
        const deliveryDate    = document.getElementById("deliveryDate").value;
        const paymentMethods  = document.getElementById("paymentMethods").value.trim();
        const files           = imageInput.files;

        const turnstileToken  = document.querySelector('#sellForm [name="cf-turnstile-response"]')?.value;

        if (!college_name) {
            verificationStatus.innerHTML = "<span style='color: #f87171;'>❌ College/University selection is required.</span>";
            submitBtn.disabled = false;
            submitBtn.innerText = "List Product";
            return;
        }

        if (!turnstileToken) {
            verificationStatus.innerHTML = "<span style='color: #f87171;'>❌ Please complete the security check.</span>";
            submitBtn.disabled = false;
            submitBtn.innerText = "List Product";
            return;
        }

        try {
            let image_urls = [];

            if (files.length > 0) {
                verificationStatus.textContent = "Uploading images...";

                const uploadPromises = Array.from(files).map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = async ev => {
                            try {
                                const res = await window.authFetch('/api/listings/upload-image', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        name: file.name,
                                        type: file.type,
                                        data: ev.target.result.split(',')[1]
                                    })
                                });
                                const result = await res.json();
                                if (result.success) resolve(result.url);
                                else reject(result.message);
                            } catch (err) { reject(err); }
                        };
                        reader.readAsDataURL(file);
                    });
                });

                image_urls = await Promise.all(uploadPromises);
                verificationStatus.textContent = "🤖 Processing images through Gemini AI pipeline...";
            } else {
                throw new Error("You must upload at least one product picture for AI validation checks.");
            }

            const res = await window.authFetch('/api/listings/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title, 
                    category, 
                    price, 
                    condition, 
                    description, 
                    college_name, 
                    contact_no: contactNo,
                    delivery_date: deliveryDate, 
                    payment_methods: paymentMethods, 
                    image_urls,
                    'cf-turnstile-response': turnstileToken
                })
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.message);

            verificationStatus.innerHTML = "<span style='color: #10b981; font-weight:700;'>✅ Verified and Listed successfully!</span>";
            setTimeout(() => { window.location.href = '/marketplace'; }, 1000);

        } catch (err) {
            console.error(err);
            if (window.turnstile) turnstile.reset(); 
            verificationStatus.innerHTML = "❌ Failed: " + err.message;
            alert("Error: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "List Product";
        }
    });
});