# Effect of vaccine dose intervals: Considering immunity levels, vaccine efficacy, and strain variants for disease control strategy

Samiran Ghosh, Malay Banerjee, Amit K. Chattopadhyay  
DOI: 10.1371/journal.pone.0310152

## Abstract

In this study, we present an immuno-epidemic model to understand mitigation options during an epidemic break. The model incorporates comorbidity and multiple-vaccine doses through a system of coupled integro-differential equations to analyze the epidemic rate and intensity from a knowledge of the basic reproduction number and time-distributed rate functions. Our modeling results show that the interval between vaccine doses is a key control parameter that can be tuned to significantly influence disease spread. We show that multiple doses induce a hysteresis effect in immunity levels that offers a better mitigation alternative compared to frequent vaccination which is less cost-effective while being more intrusive. Optimal dosing intervals, emphasizing the cost-effectiveness of each vaccination effort, and determined by various factors such as the level of immunity and efficacy of vaccines against different strains, appear to be crucial in disease management. The model is sufficiently generic that can be extended to accommodate specific disease forms.

## 1 Introduction

In recent decades, the global population has faced a series of viral outbreaks, each leaving a significant impact on health, society, and the economy. These include the SARS epidemic of 2002-2003 [1, 2], the H5N1 influenza outbreak in 2005 [3, 4], the H1N1 influenza pandemic in 2009 [5, 6], the Ebola crisis in 2014 [7, 8], and currently, the ongoing and unpredictable COVID-19 pandemic [9, 10], which has persisted for more than two years. These successive epidemics have posed substantial challenges to public health, social structures, and economic systems worldwide.

The field of epidemic modeling has witnessed significant advancements, expanding beyond simple models to embrace more intricate frameworks. Noteworthy developments include the evolution towards multi-compartment models [11–13], models with time-varying or nonlinear disease transmission rates [14, 15], multipatch models [16–18], agent based models [19, 20], and multigroup models [21, 22]. Furthermore, the exploration of spatiotemporal aspects has led to the formulation and study of spatiotemporal models, as evidenced by [23, 24]. Some other analyzes on the dynamics of SIR models can be found in the literature [25, 26]. For a comprehensive exploration of these topics, one can refer to monographs such as [12, 27, 28].

Vaccination stands as a cornerstone in combatting the spread of infections, with established vaccines for diseases like measles, typhoid, poliomyelitis, tuberculosis, malaria, Haemophilus influenzae type-b (Hib), Japanese encephalitis, pneumococcal disease, meningococcal meningitis, and the more recently developed COVID-19, according to the World Health Organization [29]. Concurrently, ongoing efforts are directed towards developing vaccines and monoclonal antibodies for diseases such as enterotoxigenic Escherichia coli, herpes simplex virus, shigella, norovirus, and improved influenza [29]. As vaccination programs progress, critical questions arise regarding the availability of vaccines, the rate at which vaccine efficacy diminishes, and the optimal dosage regimen, especially in scenarios of limited vaccine supply. The focus shifts to determining the optimal interval between consecutive vaccine doses, a crucial consideration to avoid unnecessary doses and the associated hysteresis effect, thereby optimizing the use of vaccines and financial resources. In the context of the Oxford/AstraZeneca COVID-19 (AZD1222) vaccine groups, it has already been shown that accurate implementation of dosage intervals plays a key role in vaccine efficacy [30]. This is somewhat complementary to optimizing vaccine dosing schedules that can prolong immunity and suppress the emergence of new variants of SARS-CoV-2 potentially due to intermittent lapses in protection [31]. None of these approaches though incorporate the crucial comorbidity factor that is the central premise of this study, in conjunction with dosage interval moderation.

Determining a suitable and optimal gap between two consecutive vaccinations plays a pivotal role in controlling an epidemic and minimizing economic costs for several reasons. First and foremost, the timing of vaccine doses directly influences the development and sustainability of immunity within the population. A well-calibrated gap allows for the optimal buildup of immune responses, providing a more robust shield against the spread of infectious diseases. Moreover, finding the right interval between vaccine doses is crucial for preventing the resurgence of infections. Administering doses too closely may lead to a diminishing effect, potentially causing a hysteresis effect, where the immunity gained from the first dose interferes with the effectiveness of the subsequent doses. On the other hand, spacing doses too far apart may leave individuals vulnerable to infection during the gap, reducing the overall efficacy of the vaccination strategy. Another less discussed issue is the *in vitro* versus *in vivo* modes of operation: a vaccine developed under laboratory conditions may not be as effective in real-life situation. More importantly, with other variants, e.g. the Delta variant, the booster dose may lose potency faster than anticipated, facts that have been recently modeled [32].

From an economic perspective, the cost associated with vaccination programs is a significant consideration. Frequent vaccination incurs not only direct costs related to the purchase and administration of vaccines but also indirect costs tied to the disruption of regular activities, strain on healthcare resources, and potential economic losses due to illness and workforce absenteeism. Therefore, optimizing the vaccination gap is crucial in striking a balance between widespread infection and the financial investment required for effective immunization programs.

Compartmental epidemic models, where each compartment is determined by the daily number of cases and disease transmission rates, recovery, and death rates are distributed over the time-since-infection, offer a more accurate depiction of epidemic progression compared to classical SIR-type models [33–35]. In this study, we present an epidemic model where all parameters are distributed over time following an infection, thereby accounting for the dynamically changing level of immunity in the population. The level of immunity in the population is influenced by the acquired immunity of the recovered and multiple vaccine doses administered in the population at specified intervals. Additionally, we introduce a comorbid compartment with higher infectivity, implicitly capturing the impact of multiple strains on determining the number and height of epidemic peaks within a specific time interval. We estimate all relevant time-distributed parameters using available clinical and experimental data. Our modeling results reveal that the coexistence of multiple strains can influence the frequency and height of epidemic outbreaks. Furthermore, our findings indicate that frequent vaccine administration may not be necessary and could be substituted by an effective immunity memory build-up through a hysteresis effect. The optimal gap between two consecutive vaccines should be determined by analyzing the level of immunity in the population. To address this, we formulate an optimal control problem aimed at minimizing both the number of infections and the economic costs related to vaccination. The primary objective of this work is to achieve a clear understanding of the optimal gap between two consecutive vaccinations, a dimension that has not been thoroughly explored in the existing literature.

The article is structured as follows: In Section 2, we formulate the model incorporating time-distributed parameters and the dynamic level of immunity, additionally introducing a model that considers the impact of multiple strains. The calculation of the basic reproduction number is presented in the same section. Section 3 is dedicated to the estimation of relevant time-distributed rate functions, using available clinical and experimental data. The results and findings, including the influence of multiple strains and the observed hysteresis effect resulting from the gap between consecutive vaccine doses, are discussed in Section 4.

## 2 Model formulation

### 2.1 Basic model

We consider a population with four compartments: susceptible individuals (*S*(*t*)), infected individuals (*I*(*t*)), recovered individuals (*R*(*t*)) and dead individuals (*D*(*t*)). It is assumed that the sum of these compartments remains constant and equals the total population *N*, i.e.,

S(t) + I(t) + R(t) + D(t) = N; for all t � 0 (1)

Let *J*(*t*) denote the number of newly infected individuals at time *t*, which is governed by the following equation *dS*(*t*)

= − J(t) (2)

*dt*

The classical SIR-type epidemic models assume that the number of newly infected individuals is proportional to the product of the number of infected *I*(*t*) and the number of susceptible *S*(*t*) at time *t*. However, in more realistic scenarios, this assumption is not true, and the disease transmission rate depends upon time-since-infection for the infected individuals [33]. Since the viral load dynamics within an infected individual varies with time-since-infection, the infectivity of the infected individuals also varies with time-since-infection [35]. Here, we consider the number of new infections determined by time-since-infection dependent transmission rate, given by the following equation:

Z t

S(t)

J(t) = b(t − Z)J(Z)dZ (3)

*N* _0

We assume here that the infection transmission rate at time *t* from the individuals *J*(η) infected at time η depends on the time difference *t* − η. In the case of respiratory viral infections, it depends on the viral load in the upper respiratory tract. We will specify the function β(*t*) below.

Similarly, the number of newly recovered *Rn*(*t*) and dead individuals *Dn*(*t*) can be described by the following equations:

Z t Z t

*dR*(*t*) *dD*(*t*)

Rn(t) � = r(t − Z)J(Z)dZ; Dn(t) � = d(t − Z)J(Z)dZ (4)

Distributed recovery and death rates *r*(η) and *d*(η) assume the probability of recovery and death as functions of time-since-infection η. They are determined from the immunological (clinical) data (see Section 3).

Finally, differentiating equality (1) and taking into account (2)–(4), we obtain the equations for *S*(*t*) and *I*(*t*) as follows:

Z t

*dS*(*t*) *S*(*t*)

= − b(t − Z)J(Z)dZ (5)

Z t Z t Z t

*dI*(*t*) *S*(*t*)

= b(t − Z)J(Z)dZ − r(t − Z)J(Z)dZ − d(t − Z)J(Z)dZ (6)

Completing them by equations (2) and (4), we obtain the formulation of an immuno-epidemiological model with distributed infectivity, recovery and death rates.

### 2.2 Vaccination and immunity

The level of immunity in the population plays an important role in combating the progression of the epidemic. This level of immunity can vary over time based on several important factors, such as the rate of vaccination, time-post-vaccination-dependent vaccine effectiveness, and time-post-recovery-dependent acquired immunity.

To account for the influence of vaccination on epidemic progression, we introduce a new variable *m*(*t*) corresponding to the immunity level in the population. First, we analyze the relationship of the immunity level with vaccination. This is hypothesized through the constitutive relation

Z t

1 0

m(t) = �(t − Z)V (Z)dZ (7)

*N* _0

where *V*(*t*) is the number of vaccinated individuals at time *t*, and *V*^0(*t*) is the rate of vaccination, the function *ϕ*(*t*) describes how immunity changes with time. It is a positive function with *ϕ*(0) = 1 (if a vaccine is initially fully efficient), otherwise *ϕ*(0) > 0, then it increases up to some maximal value and decreases after that due to immunity waning. Overall, we assume that 0 < *ϕ*(*t*) < 1.

#### 2.2.1 Multiple vaccination doses

Now, we incorporate the impact of multiple vaccine doses in the population at various intervals. The expression for the immunity level *m*(*t*) is then provided as follows:

Z !

1 X^K ^t

m(t) = �i(t − Z)Vi0(Z)dZ (8)

Here *Vi*(*t*) and *ϕi*(*t*) denote the number of vaccination and the efficacy of vaccines respectively corresponding to all the doses, starting from *i* = 1. *K* is the total number of doses administrated in the population. Suppose that two consecutive vaccine doses *i* and *i* + 1 are administrated we have

8

\> 0; t < T0 + T1;2 + T2;3 + � � � + Ti− 1;i

\>>

<

Vi(t) = (9)

\>>

\>:

positive; *t* � *T*_0 + *T*_{1;2} + *T*_{2;3} + � � � + *Ti*_{− 1;i}

Although the effectiveness of the initial vaccine dose and subsequent booster doses may differ, for the sake of simplicity, we assume uniform efficacy for all vaccine doses in this study. Our interest in this part of the analysis is to understand whether multiple booster doses compound the effects of the previous rounds of vaccination or reach a plateau beyond which they are ineffective.

#### 2.2.2 Acquired immunity of recovered

Next, consider the acquired immunity of the recovered individuals. Then the effective immunity at time *t* coming from both the vaccination of healthy susceptible *S* and the infection acquired immunity is given by:

Z ! Z

m1(t) = �i(t − Z)Vi0(Z)dZ + c(t − Z)Rn(Z)dZ (10)

and the effective immunity at time *t* coming from vaccination of comorbid class *P*(*t*) is given by:

Z ! Z

m2(t) = �i(t − Z)Vi0(Z)dZ + �c(t − Z)Rn(Z)dZ (11)

where, 0 < � < 1 is a constant, α is the proportion of healthy susceptible *S* who are newly vaccinated. The value of � < 1 signifies that the infection acquired immunity for the comorbid individuals is less than that for the non-comorbid individuals. Parameter *b* characterizes the proportion of comorbidity among the newly recovered individuals while the function *ψ*(*t*) describes how acquired immunity changes over time. We choose functions *ϕj* and *ψj* focusing on multiple criteria, prioritizing the acquisition-fading function, exponential fading function and the power law function. The functional fits are parameterized against epidemiological data comprising the epidemic form. Assuming homogeneity, we consider *ϕj* � *ϕ* and *ψj* � *ψ*, for *j* = 1, 2, � � �, *K*. Moreover, to account for “bounded” infection growth, we impose a constraint on the population immunity level: 0 < *m*_{1(}*t*) + *m*_{2(}*t*) < 1.

#### 2.2.3 Impact of multiple strains

Immunity in the population corresponds to the decrease of the number of susceptible individuals. As such, instead of equality (1), we have

S(t) = N − (I(t) + D(t) + P(t) + m1(t)N) (12)

Note that *m*_2(*t*) does not appear in the Eq (12) because *m*_2(*t*) is the level of immunity in the comorbid class; it is only considered later in the equation for *P*(*t*), where *P*(*t*) is the predisposed comorbid population. Let, *J*_{1(}*t*) represents the number of daily new infection in the healthy susceptible class *S*(*t*) and *J*_2(*t*) represents the number of daily new cases in the comorbid class *P*(*t*). Then the total number of daily new cases is given by

J(t) = J1(t) + J2(t);

where,

Z t

S(t)

*J*_1(*t*) = b(*t* − Z)*J*(Z)*d*Z; *N* _0

Z t

k*P*(*t*) *J*_2(*t*) = b(*t* − Z)*J*(Z)*d*Z; *N* _0

κ > 1 is a constant, which signifies that the comorbid individuals are more prone to the infection as compared to the non-comorbid individuals.

The governing equation for the comorbid class *P*(*t*) is given by

Z t Z t

P(t) = b Rn(Z)dZ − J2(Z)dZ − m2(t)N (13)

The equation for the infected compartment is given by

Z t Z t Z t

*dI S*(*t*) + k*P*(*t*)

= b(t − Z)J(Z)dZ − r(t − Z)J(Z)dZ − d(t − Z)J(Z)dZ (14)

Finally the equations for the recovered and death compartments are

Z t

*dR dD*

= (1 − b)Rn(t); = d(t − Z)J(Z)dZ (= Dn(t)) (15)

where,

Z t

*Rn*(*t*) = *r*(*t* − Z)*J*(Z)*d*Z; which represents the daily sum of completely recovered individuals (with proportion (1 − *b*)) and comorbid individuals (with proportion *b*). We obtain complete model (10)–(15) with distributed infection, recovery and death rates, and population immunity. The corresponding flowchart is shown in Fig 1.

### 2.3 Basic reproduction number

In the beginning of epidemic, assume that *I* = *P* = *D* = *m*_{1 = 0. Then, using (2), we can write Eq} (5) in the following form:

Z t

0 S 0

S (t) = b(t − Z)S (Z)dZ (16)

*N* _0

Suppose, *S*(*t*) = *N* − �*e*^{λt}. Then from the above equation we get,

= − �le = b(t − Z)(− �l)e dZ (17)

Now equating the terms with the first power of � in both sides we get:

Z t

Z t (18)

) 1 = b(t − Z)e− l(t− Z)dZ:

The dispersion relation (the relation involving the parameters that determine the stability) can be obtained by setting λ = 0 and the dispersion relation is given by:

**Fig 1.** Schematic diagram. Schematic diagram for the system (10)–(15). https://doi.org/10.1371/journal.pone.0310152.g001

Z t

b(*t* − Z)*d*Z = 1; which can be written as

Z t

b(*x*)*dx* = 1: If we assume that β(*x*) > 0 for 0 � *x* � *τ* and β(*x*) = 0 for *x* > *τ*, where, *τ* is assumed to be the average disease duration. Then we can define the basic reproduction number as

Z t

R0 = b(x)dx (19)

Then λ in (18) is positive (epidemic growth) if and only if R_0 > 1.

Note The derivation of basic reproduction number remains unaltered even if we assume a reproduction substituting of the form *S*(*t*) = *N* − �*a*^{λt}, where *a* > 0.

## 3 Parameter estimation

### 3.1 Statistical toolbox

The estimations and curve fittings are done by minimizing the Sum of Squared Errors (SSE). For the curve fitting to data we mainly use the ‘Curve Fitting Toolbox’, which is a collection of graphical user interfaces (GUIs) and M-file functions built on the MATLAB technical computing environment [36]. The toolbox provides the fitted curve along with the goodness of fit. Gamma distributions are estimated using the inbuilt function *fitdist(:,gamma)* in MATLAB. This function is used to fit a vector of data *X* = (*x*_1, *x*_2, � � �, *xn*) by a gamma distribution of the form_{baG}^1_{(a)} *x*^{a− 1}*e*^{− x=b}, where *a* and *b* are the shape and scale parameters. This function gives the maximum likelihood estimators of *a* and *b* for the gamma distribution which are the solutions of the simultaneous equations

0 !1=n1

Yn

*b*^ = *X*�=*a*^;

where *X*� is the sample mean of the data *X* and C is the digamma function given by

C(x) = G0(x)=G(x):

The function *fitdist(:,gamma)* estimates the shape and scale parameters with 95% confidence interval.

### 3.2 Choice of vaccination function V(t)

We assume that the vaccination function *V*(*t*) that is started at time *t* = *t*_{0, follows the function}

(

0; *t* < *t*_0

V(t) = (20)

*L*½*N* − (*N* − *V*_0)*e*^{− k(t− t0)}�; *t* � *t*_0

where, *N* is the total population size, *L* is the proportion of the population expected to be vaccinated, *k* is the rate of vaccination, *V*_0 is the number of vaccination at time *t* = *t*_0, and the associated parameter values are listed in Table 1.

### 3.3 Estimation of ϕ(t) and ψ(t)

Due to the lack of availability of sector data, that is separate data incorporating the impacts of comorbidity and the ones without, we take an initial simplifying step by assuming that *ϕj* � *ϕ* and *ψj* � *ψ*, for *j* = 1, 2, � � �, *N*. We use the data of vaccine-induced immunity from [35] and fit (least square fitting) the function *ϕ*(*t*) as follows (see Fig 2a and 2b)

�(t) = a e− c11 (21)

where, *a*_1 = 0.9411 with 95% CI (0.8886, 0.9937), *b*_1 = 117.8 with 95% CI (113.5, 122), and *c*_1 = 92.44 with 95% CI (86.06, 98.82) (Fig 2a). The goodness of fit is as follows: SSE = 0.2807, R- square = 0.9308, Adjusted R-square = 0.9273 and RMSE = 0.08483.

**Table 1.** Parameter values.

| Parameters | Description | Estimated value | Source |
| --- | --- | --- | --- |
| *N* | Total population | 10^7 | - |
| *V*_0 | Initial number of vaccination | 500 | - |
| *L* | proportion of population to be vaccinated expected to be vaccinated | 0.75 | - |
| *k* | rate of vaccination | 0.002, 0.003, 0.005 | - |
| *c* | proportionality constant | 0.44 × 10^{−5} | - |
| α | proportion of vaccination among susceptible | 0.8 | - |
| κ | proportionality constant | 1.1 | - |
| *b* | rate of comorbidity | 0.2 | - |
| � | - | 0.7 | - |
| *ϕ*(*t*) | effectiveness of vaccine | Eq (21) | [35, 37] |
|  | • induced immunity | (Fig 2a) |  |
| *ψ*(*t*) | effectiveness of infection | Eq (23) | [35, 38] |
|  | • acquired immunity | (Fig 2b) |  |
| *P*(*τ*) | Viral load | Eq (24) (Fig 3) | [35, 39, 40] |

Now we fit the same data of vaccine-induced immunity with a stretched power-law function given by

�(t) = a2tb2e− c2td2 (22)

*c*_2 = 5.01 × 10^{−6} with 95% CI (−1.398 × 10^{−5}, 2.4 × 10^{−5}), *d*_2 = 2.412 with 95% CI (1.747, 3.077) (Fig 2b). The goodness of fit is as follows: SSE = 0.2218, R-square = 0.9453, Adjusted R- square = 0.941 and RMSE = 0.0764. It must be noted that death due to natural causes versus death due to infection have two different timescales of operation; the former is way more protracted than the latter, an aspect that plays a major role in ascribing average values to death rates in comorbidity models.

We observe that the stretched power law function (22) gives better fitting to the data as compared to the Gaussian function (21). To check the robustness of the choice of the stretched power law function (22) we compared the goodness of fit with other possible candidates such as the Gaussian function and, acquisition-fading function.

The function for the effectiveness of acquired immunity *ψ*(*t*) is fitted to the data available in [38], by the following function (Fig 3):

c(t) = a e− c33 (23)

where, *a*_{3 = 1.035 with 95% CI (0.8742, 1.195),} *b*_{3 =} −206.6 with 95% CI (−704.3, 291) and *c*_{3 =} 1133 with 95% CI (500.3, 1765).

### 3.4 Estimation of transmission rate β(τ)

We assume that the transmission rate β(*τ*) is proportional to the viral load *P*(*τ*), i.e., β(*τ*) = *cP* (*τ*), where, *c* is a proportionality constant and it depends upon the transmission rate (which mainly depends on the behavioral aspects and not on the virus variants) between infected and susceptible individuals. We fit the function *P*(*τ*) with the experimental data of viral load depending on the number of hours post-infection as available in [39]. In [39], the authors experimented to understand the viral replication kinetics of SARS-CoV-2 variants in ex vivo cultures of the human respiratory tract and the experiment was performed up to 71 hourspost-infection. Also, we assume that after 10 days of the days-post-infection, the viral load becomes negligible [40]. Using all these information, we fit *P*(*τ*) by the following function (Fig 4):

**Fig 2.** Effectiveness of vaccine-induced immunity. The effectiveness of vaccine-induced immunity *ϕ*(*t*) as a function of the days post-vaccination (data source- [35, 37]). The shaded regions represent the 95% confidence interval of the fitted function in the epidemiologically feasible region. (a) corresponds to the formula (21); (b) corresponds to the formula (22). https://doi.org/10.1371/journal.pone.0310152.g002

**Fig 3.** Effectiveness of infection-acquired immunity. The effectiveness of infection-acquired immunity *ψ*(*t*) as a function of the days post recovery (data source- [35, 38]). The blue dots are the real data and the red curves are the functions fitted to the data. The shaded region represents the 95% confidence interval of the fitted function. The details of the fitted parameter values are given in the text. https://doi.org/10.1371/journal.pone.0310152.g003

P(t) = a e− c4 4 (24)

where, *a*_{4 = 1.829} × 10^5 with 95% CI (1.805 × 10^5, 1.852 × 10^5), *b*_{4 = 3.136 with 95% CI (3.073,}

**Fig 4.** Viral load. Viral load as a function of the days post infection. The blue dots are the real experimental data for Omicron variant taken from [39]. The red curve is the gamma function fitted to the blue dots. The shaded region represents the 95% confidence interval of the fitted function. The details of the fitted parameter values are given in the text. https://doi.org/10.1371/journal.pone.0310152.g004

### 3.5 Estimation of r(t) and d(t)

In the literature on epidemic modelling, the choice of gamma distributions to model distributed recovery period is well known [41–43]. However, the use of bimodal gamma distributions in epidemic modeling can indeed provide a more accurate representation of the recovery or death rate functions when there are distinct groups with different time intervals. From a linear combination of two different gamma distributions, we can capture the variability in the recovery or death times more effectively. The recovery and death distributions used in [35] and are given by:

r(t) = p0F 1(t); d(t) = (1 − p0)F 2(t) (25)

where, *b*_1 G(*a*_1) *d*_1 G(*c*_1) and *b*_2 G(*a*_2) *d*_2 G(*c*_2) All other parameter values are listed in the Table 1.

**Fig 5.** Time-distributed recovery and death rates. Time-distributed rate functions of (a) recovery and (b) death as functions of days post the onset of infection. The red curves show the best fitted bimodal gamma distributions (Ref. [35]). https://doi.org/10.1371/journal.pone.0310152.g005

## 4 Results and findings

### 4.1 Impact of multiple strains

In this section, we study the influence of the existence of multiple strains on the epidemic progression in a population. Here the parameter κ accounts for the existence of multiple strains. A higher value of κ implies the co-existence of prominent strains with very different transmission rates. In Fig 6, we plot *I*(*t*) for different choices of κ. We observe that as the value of κ increases, the number of epidemic peaks also increases and the peaks appear relatively frequently. This finding points to multiple infection waves for epidemics driven by multiple strains compared to a single wave for single-strained infections. However, the maximum height of individual peaks is seen to decrease as has been recently observed with the Covid second and third waves [9].

**Fig 6.** Plot of I(t) for different choice of κ. The associated parameter values are chosen as estimated before and as in Table 1. https://doi.org/10.1371/journal.pone.0310152.g006

**Fig 7.** Plot of I(t) for different choice of κ. (a) κ = 1; (b) κ = 2; (c) κ = 3. The bold colored curves correspond to *c*_{3 = 1133 in formula (23). The light colored curves} correspond to 20 randomly chosen values of *c*_3 in the interval [1033, 1233]. The other associated parameter values are chosen as estimated before and as in Table 1.

To explain the sensitivity of the model parameters on the model outcome *I*(*t*), we randomly chose 20 values of *c*_3 (in formula (23)) within the interval [1033, 1233]. The outcome *I*(*t*) is shown in Fig 7. In this figure, the bold color curves correspond to *c*_{3 = 1133, while the light} color curves correspond to the 20 randomly chosen values of *c*_{3. This simulation result demon-} strates that the model outcome *I*(*t*) is sensitive to the model parameters, although the principal trend of the outcome remains largely unchanged. Another important observation is that the first epidemic peak is not sensitive to the parameter *c*_{3. This is because, at the beginning of the} epidemic, the acquired immunity function (as described in (23)) is not very influential, and as the epidemic progresses, this acquired immunity function causes variations in *I*(*t*). Similar sensitivity analyzes were performed for other parameters, but the main trend of the outcome remained nearly the same.

### 4.2 Effect of interval between successive vaccine doses: Hysteresis effect

In this section, we investigate the effect of the gap between two consecutive doses of vaccination. We assume a time range from 0 to *T* = 2000 days (which is almost 5.5 years), where we’re trying to control an epidemic. To explain the effect we consider three scenarios as follows:

Scenario-1: Vaccine doses administered with 4 months gap.

Scenario-2: Vaccine doses administered with 8 months gap.

Scenario-3: Vaccine doses administered with 12 months gap.

For simplicity, we assumed that each vaccine dose has the same efficacy. From Fig 8, we observe that Scenario-1 and Scenario-2 depict almost the same epidemic progression whereas Scenario-3 depicts a different type of progression. The result shows that instead of administrating the vaccine with a gap of 4 months, a vaccination spanning a gap of 8 months produces the same type of epidemic progression, though the level of immunity is slightly less. Also, we note that Scenario-1 requires repeated vaccinations compared to Scenario-2 within the period 0 to 2000 days, but both scenarios eventually accord the same level of immunity. This is a key observation that can help us to avoid unnecessary vaccinations. On the other hand, from Fig 8 (e) and 8(f), we observe that if the vaccination gap is larger (i.e., 1 year in this case), then consecutive epidemic peaks can appear in future. Thus a proper gap should be maintained to minimize future epidemic outbreaks. The summary of these observations is the need to exercise optimal control.

**Fig 8.** Impact of vaccine dose intervals. (a), (b) correspond to Scenario-1; (c), (d) correspond to Scenario-2; (e), (f) correspond to Scenario-3. The associated parameter values are chosen as estimated before and as in Table 1.

### 4.3 Optimization problem

Based on the previous numerical results, we can consider the following optimization problem:

Z T

J (n) = min c I(t; n)dt + dn (26)

where *T* > 0 is the maximum time we consider. *n* is the number of vaccination campaigns administrated in the population during the time interval [0, *T*]. We assume that *T* = *an*, for some *a* > 0, i.e., two vaccination campaigns are considered with a gap of *a* time units. *d* is a positive constant that accounts for the cumulative cost per vaccination campaign. *m*(*t*; *n*) and *I* (*t*; *n*) denote the level of immunity and number of infected at time *t* for a given *n*, respectively. *I*(*t*; *n*) is the solution of our model for a particular choice of *n*. *c* is a positive constant that accounts for the cost due to infection for an infected individual. The above cost function J (*n*) can equivalently be written as a function of *a* as follows:

Z T

*T*

J (a) = min c I(t; a)dt + d (27)

**Fig 9.** Plot of cost function J (a). Plot of cost function J (*a*) for *c* = 0.01, *d* = 5, and all other parameter values are chosen as estimated before and as in Table 1. https://doi.org/10.1371/journal.pone.0310152.g009

where, *I*(*t*; *a*) denotes the number of infected at time *t* for a given *a*. The Fig 9 shows the plot of the cost function defined in relation (27). Fig 9 provides valuable insights into the behavior of the cost function concerning the gap between two consecutive vaccinations. Fig 9 shows that the cost function more or less remains at the minimum when the gap between two successive vaccinations falls within the range of 3 to 8 months. However, the plot takes an interesting turn when the gap between consecutive vaccinations exceeds 9 months. Beyond this point, the cost function begins to rise abruptly.

This critical observation suggests that excessively long intervals between vaccinations can be counterproductive, potentially leading to a surge in disease transmission and associated costs. This result shows that frequent vaccinations may not always be necessary and could potentially lead to diminishing returns, a phenomenon often referred to as hysteresis, whereas, an admissible larger gap between two consecutive vaccinations can effectively control the epidemic along with the minimal cost of vaccination campaign. This finding explains the significance of carefully determining the appropriate gap between two consecutive vaccination campaigns for effective epidemic control while minimizing economic burdens on a country or province.

### 4.4 Effect of vaccine efficacy and vaccination rate

A vaccination campaign focuses on two major aspects, the effectiveness of the vaccines and the rate of vaccination. These two factors can depend on the decision-makers. Thus it is important to understand the effect of vaccine efficacy and the rate of vaccination on the cost function. In Fig 10, we plot the cost function J for two different vaccine efficacies. We notice that if the vaccine efficacy is less (red curve in Fig 10) then the cost function remain at the minimum if the gap between the successive vaccination varies between 3 to 6 months. In contrast, if the vaccine efficacy is larger (blue curve in Fig 10) then the cost function stays at a minimum if the gap between the successive vaccinations varies between 3 to 9 months. This observation suggests that highly effective vaccines may allow for more extended gaps between vaccinations, potentially reducing the frequency and cost of vaccination while still achieving effective epidemic control. Fig 11 shows the plot of the cost function J for two different vaccination rates. This figure shows that a higher vaccination rate provides more flexibility in increasing the gap between campaigns while still controlling the epidemic effectively and minimizing costs. The results are reminiscent of the recent experiences concerning COVID-19 vaccines [9]. This insight suggests that decision-makers should carefully consider both vaccine efficacy and vaccination rate when designing vaccination strategies to achieve cost-effective epidemic control.

**Fig 10.** Plot of cost function J (a) for different vaccine efficacy functions. Green: corresponds to formula (21) and Red: corresponds to formula (21) multiplied by 0.7. The parameter values: c = 0.01, d = 5, and all other parameter values are chosen as estimated before and as in Table 1. https://doi.org/10.1371/journal.pone.0310152.g010

### 4.5 Effect of co-existing strains

The parameter κ accounts for the existence of multiple strains. A higher value of κ implies the co-existence of prominent strains with very different transmission rates. Fig 12 shows that a higher value of κ provides less flexibility in increasing the gap between campaigns.

## 5 Discussion and conclusion

To eradicate an infectious disease through immunization, a single dose of vaccination may not be sufficient; rather, supplemental vaccine doses are essential to keep the level of immunity in the population sufficiently high over time and reduce the number of susceptible in order to achieve disease control or elimination goals [44]. In this regard, the optimal scheduling of successive vaccination is very important, keeping in mind the cost of vaccination. In the context of diseases like Measles and Rubella, the Measles & Rubella Initiative [45] has provided support to measles-burdened countries, focusing on sustaining high immunization coverage of children and supplementing it with supplemental doses. The comprehensive study in this work can be helpful in designing the optimal timing of successive vaccination campaigns.

In this work, we present a comprehensive immuno-epidemic model that integrates comorbidity and the administration principle of multiple vaccine doses. The study employs a system of integro-differential equations to capture the evolving dynamics of infection and immunity over time. Considering all model parameters distributed over time-since-infection, we analyze for the dynamic changes in population immunity, determined by acquired immunity from recovered individuals and by the vaccine-induced immunity developed through multiple vaccine doses at specified intervals. The introduction of a comorbid compartment with higher infectivity allows us to implicitly capture the impact of multiple strains on the frequency and magnitude of epidemic peaks within specific time intervals.

We estimate the relevant time-distributed parameters with the help of available clinical and experimental data. Notably, our modeling results point to the substantial influence of coexisting multiple strains on both the frequency and height of epidemic outbreaks. Furthermore, we demonstrate that frequent vaccine administration may not be required and can potentially lead to a hysteresis effect on immunity levels, thus neutralizing the impact of vaccines in the longer run, sort of an anti-microbial effect. This finding challenges the conventional wisdom regarding the necessity of high-frequency vaccination strategies and indicates its negative consequence over a sustained period of administration.

It is important to mention that, the Table 1 enlists parameter values (*N*, *V*_{0,} *L*, *k*, *c*, α, κ, *b*, �) that are extracted from data modeling together with functions (*ϕ*(*t*), *ψ*(*t*), *P*(*τ*), *r*(*t*), *d*(*t*), *V*(*t*)) that have been implemented in contemporary references (all cited in the text, with the exception of *V*(*t*)). There are no known references to confirm the parameter values predicted. However, as the confidence intervals and supporting sensitivity analysis demonstrate, the model is sufficiently generic and robust against changes in parameter values, a prediction that awaits validation from future experiments.

**Fig 11.** Plot of cost function J (a) for different vaccination rates. The left panel corresponds to formula (20) with the rate of vaccination *k* = 0.001 (green) and *k* = 0.003 (red). The right panel corresponds to the plot of the cost function with corresponding colors. The parameter values: c = 0.01, d = 5, and all other parameter values are chosen as estimated before and as in Table 1. https://doi.org/10.1371/journal.pone.0310152.g011

**Fig 12.** Plot of cost function J (a) for different values of κ. The green and red curves correspond to κ = 2 and κ = 1 respectively. The parameter values: c = 0.01, d = 5, and all other parameter values are chosen as estimated before and as in Table 1. https://doi.org/10.1371/journal.pone.0310152.g012

A critical insight arising from our findings is the paramount importance of determining the optimal gap between two consecutive vaccine doses. We emphasize that this determination should be driven by a meticulous analysis of the evolving level of immunity within the population. To address this, we propose an optimal control strategy aimed at minimizing both the number of infections and the economic costs associated with vaccination efforts. This approach underscores the need for a tailored and strategic vaccination plan that considers the interplay of factors such as population immunity, vaccine efficacy against different strains, and the cost-effectiveness of each vaccination effort. In summary, our primary objective has been to contribute to the understanding of the optimal gap between two consecutive vaccinations. Our findings highlight the complexity of disease control strategies, advocating for a more nuanced and adaptable approach that accounts for the interplay of immunity dynamics, multiple strains, and vaccination frequency in shaping effective public health interventions.

The model presented in this study is generic and applicable to various epidemic diseases. In this specific analysis, we have resorted to simplifying assumptions like homogeneous propagation, absence of ethnic migration, and patient compartmentalization, etc. that can be subjectively assessed against specific data through minor modifications of this model. Our assumption of equal effectiveness across all vaccine doses and the lack of differentiation between individuals who received the first, second, or booster dose are the limitations of the present work. Future research could enhance the model’s precision by incorporating more accurate data on vaccine efficacy and distinguishing between different doses to calculate immunity levels more effectively. Additionally, the model’s assumption of a homogeneous population, with individuals sharing similar immune statuses, overlooks potential variations influenced by factors like age. Subsequent investigations could enrich the model by introducing population heterogeneity through age-structured modeling, providing a more realistic representation of the epidemic dynamics.

## Author Contributions

Conceptualization: Malay Banerjee, Amit K. Chattopadhyay. Data curation: Samiran Ghosh. Formal analysis: Samiran Ghosh, Malay Banerjee, Amit K. Chattopadhyay. Investigation: Samiran Ghosh, Amit K. Chattopadhyay. Methodology: Samiran Ghosh, Malay Banerjee, Amit K. Chattopadhyay. Software: Samiran Ghosh. Supervision: Malay Banerjee. Validation: Samiran Ghosh. Visualization: Samiran Ghosh. Writing – original draft: Samiran Ghosh, Malay Banerjee, Amit K. Chattopadhyay. Writing – review & editing: Malay Banerjee, Amit K. Chattopadhyay.

## References

- [1] Anderson Roy M, Fraser Christophe, Ghani Azra C, Donnelly Christl A, Riley Steven, Ferguson Neil M, et al. Epidemiology, transmission dynamics and control of sars: the 2002–2003 epidemic. *Philosophical Transactions of the Royal Society of London. Series B: Biological Sciences*, 359(1447):1091–1105, 2004. https://doi.org/10.1098/rstb.2004.1490 PMID: 15306395
- [2] Xing Weijia, Hejblum Gilles, Leung Gabriel M, and Valleron Alain-Jacques. Anatomy of the epidemiological literature on the 2003 sars outbreaks in hong kong and toronto: a time-stratified review. *PLoS medicine*, 7(5):e1000272, 2010. https://doi.org/10.1371/journal.pmed.1000272 PMID: 20454570
- [3] Chen H, Smith GJD, Li KS, Wang J, Fan XH, Rayner JM, et al. Establishment of multiple sublineages of h5n1 influenza virus in asia: implications for pandemic control. *Proceedings of the National Academy of Sciences*, 103(8):2845–2850, 2006. https://doi.org/10.1073/pnas.0511120103 PMID: 16473931
- [4] Kilpatrick A Marm, Chmura Aleksei A, Gibbons David W, Fleischer Robert C, Marra Peter P, and Daszak Peter. Predicting the global spread of h5n1 avian influenza. *Proceedings of the National Academy of Sciences*, 103(51):19368–19373, 2006. https://doi.org/10.1073/pnas.0609227103 PMID: 17158217
- [5] Girard Marc P, Tam John S, Assossou Olga M, and Kieny Marie Paule. The 2009 a (h1n1) influenza virus pandemic: A review. *Vaccine*, 28(31):4895–4902, 2010. https://doi.org/10.1016/j.vaccine.2010. 05.031 PMID: 20553769
- [6] Smith Gavin JD, Vijaykrishna Dhanasekaran, Bahl Justin, Lycett Samantha J, Worobey Michael, Pybus Oliver G, et al. Origins and evolutionary genomics of the 2009 swine-origin h1n1 influenza a epidemic. *Nature*, 459(7250):1122–1125, 2009. https://doi.org/10.1038/nature08182 PMID: 19516283
- [7] Frieden Thomas R, Damon Inger, Bell Beth P, Kenyon Thomas, and Nichol Stuart. Ebola 2014—new challenges, new global response and responsibility. *The New England Journal of Medicine*, 371 (13):1177–1180, 2014. https://doi.org/10.1056/NEJMp1409903 PMID: 25140858
- [8] Holmes Edward C, Dudas Gytis, Rambaut Andrew, and Andersen Kristian G. The evolution of ebola virus: Insights from the 2013–2016 epidemic. *Nature*, 538(7624):193–200, 2016. https://doi.org/10. 1038/nature19790 PMID: 27734858
- [9] Chattopadhyay Amit K, Choudhury Debajyoti, Ghosh Goutam, Kundu Bidisha, and Nath Sujit Kumar. Infection kinetics of covid-19 and containment strategy. *Scientific reports*, 11(1):11606, 2021. https:// doi.org/10.1038/s41598-021-90698-2 PMID: 34078929
- [10] Cacho´ n-Zagalaz Javier, Sa´ nchez-Zafra Marı´a, Sanabrias-Moreno De´ borah, Gonza´ lez-Valero Gabriel, Lara-Sa´nchez Amador J, and Zagalaz-Sa´ nchez Marı´a Luisa. Systematic review of the literature about the effects of the covid-19 pandemic on the lives of school children. *Frontiers in psychology*, 11:569348, 2020. https://doi.org/10.3389/fpsyg.2020.569348 PMID: 33162910
- [11] Brauer Fred. Compartmental models in epidemiology. In *Mathematical epidemiology*, pages 19–79. Springer, 2008.
- [12] Martcheva Maia. *An introduction to mathematical epidemiology*, volume 61. Springer, 2015.
- [13] Tolles Juliana and Luong ThaiBinh. Modeling epidemics with compartmental models. *Jama*, 323 (24):2515–2516, 2020. https://doi.org/10.1001/jama.2020.8420 PMID: 32459319
- [14] Hethcote Herbert W and Van den Driessche P. Some epidemiological models with nonlinear incidence. *Journal of Mathematical Biology*, 29(3):271–287, 1991. https://doi.org/10.1007/BF00160539 PMID: 2061695
- [15] Fenichel Eli P, Castillo-Chavez Carlos, Graziano Ceddia M, Chowell Gerardo, Gonzalez Parra Paula A, Hickling Graham J, et al. Adaptive human behavior in epidemiological models. *Proceedings of the National Academy of Sciences*, 108(15):6306–6311, 2011. https://doi.org/10.1073/pnas.1011250108 PMID: 21444809
- [16] Bichara Derdei and Iggidr Abderrahman. Multi-patch and multi-group epidemic models: a new framework. *Journal of Mathematical Biology*, 77(1):107–134, 2018. https://doi.org/10.1007/s00285-017- 1191-9 PMID: 29149377
- [17] Gao Daozhou and Ruan Shigui. A multipatch malaria model with logistic growth populations. *SIAM Journal on Applied Mathematics*, 72(3):819–841, 2012. https://doi.org/10.1137/110850761 PMID: 23723531
- [18] Ghosh Samiran, Ogueda-Oliva Alonso, Ghosh Aditi, Banerjee Malay, and Seshaiyer Padmanabhan. Understanding the implications of under-reporting, vaccine efficiency and social behavior on the postpandemic spread using physics informed neural networks: A case study of china. *Plos one*, 18(11): e0290368, 2023. https://doi.org/10.1371/journal.pone.0290368 PMID: 37972077
- [19] Kerr Cliff C, Stuart Robyn M, Mistry Dina, Abeysuriya Romesh G, Rosenfeld Katherine, Hart Gregory R, et al. Covasim: an agent-based model of covid-19 dynamics and interventions. *PLOS Computational Biology*, 17(7):e1009149, 2021. https://doi.org/10.1371/journal.pcbi.1009149 PMID: 34310589
- [20] Hoertel Nicolas, Blachier Martin, Blanco Carlos, Olfson Mark, Massetti Marc, Rico Marina Sa´nchez, et al. A stochastic agent-based model of the sars-cov-2 epidemic in france. *Nature medicine*, 26 (9):1417–1421, 2020. https://doi.org/10.1038/s41591-020-1001-6 PMID: 32665655
- [21] Kuniya Toshikazu. Global stability analysis with a discretization approach for an age-structured multigroup sir epidemic model. *Nonlinear Analysis Real World Application*, 12(5):2640–2655, 2011. https:// doi.org/10.1016/j.nonrwa.2011.03.011
- [22] Li Michael Y, Shuai Zhisheng, and Wang Chuncheng. Global stability of multi-group epidemic models with distributed delays. *Journal of Mathematical Analysis and Applications*, 361(1):38–47, 2010. https:// doi.org/10.1016/j.jmaa.2009.09.017
- [23] Chang Lili, Gong Wei, Jin Zhen, and Sun Gui-Quan. Sparse optimal control of pattern formations for an sir reaction-diffusion epidemic model. *SIAM Journal on Applied Mathematics*, 82(5):1764–1790, 2022. https://doi.org/10.1137/22M1472127
- [24] Banerjee Malay, Ghosh Samiran, Manfredi Piero, and d’Onofrio Alberto. Spatio-temporal chaos and clustering induced by nonlocal information and vaccine hesitancy in the sir epidemic model. *Chaos*, *Sol- itons & Fractals*, 170:113339, 2023. https://doi.org/10.1016/j.chaos.2023.113339
- [25] Zhao Jiandong, Wang Lisha, and Han Zhixia. Stability analysis of two new sirs models with two viruses. *International Journal of Computer Mathematics*, 95(10):2026–2035, 2018. https://doi.org/10.1080/ 00207160.2017.1364369
- [26] Zhang Ziyu, Mei Xuehui, Jiang Haijun, Luo Xupeng, and Xia Yang. Dynamical analysis of hyper-sir rumor spreading model. *Applied Mathematics and Computation*, 446:127887, 2023. https://doi.org/10. 1016/j.amc.2023.127887
- [27] Brauer Fred, Castillo-Chavez Carlos, and Feng Zhilan. *Mathematical models in epidemiology*, volume 32. Springer, 2019.
- [28] Capasso Vincenzo. *Mathematical structures of epidemic systems*, volume 97. Springer Science & Business Media, 2008.
- [29] https://www.who.int/teams/immunization-vaccines-and-biologicals/diseases.
- [30] Liu Y.et al. Dosing interval strategies for two-dose covid-19 vaccination in 13 middle-income countries of europe: Health impact modelling and benefit-risk analysis. *The Lancet Reg Health*, 17:100381, 2022. https://doi.org/10.1016/j.lanepe.2022.100381 PMID: 35434685
- [31] Dogra P.et al. A modeling-based approach to optimize covid-19 vaccine dosing schedules for improved protection. *JCI Insight*, 8(13):e169860, 2023. https://doi.org/10.1172/jci.insight.169860 PMID: 37227783
- [32] Menegale F.et al. Evaluation of waning of sars-cov-2 vaccine–induced immunity: A systematic review and meta-analysis. *JAMA Netw Open*, 6(5):e2310650, 2023. https://doi.org/10.1001/ jamanetworkopen.2023.10650 PMID: 37133863
- [33] Ghosh Samiran, Volpert Vitaly, and Banerjee Malay. An epidemic model with time-distributed recovery and death rates. *Bulletin of Mathematical Biology*, 84(8):78, 2022. https://doi.org/10.1007/s11538-022- 01028-0 PMID: 35763126
- [34] Ghosh Samiran, Volpert Vitaly, and Banerjee Malay. An age-dependent immuno-epidemiological model with distributed recovery and death rates. *Journal of Mathematical Biology*, 86(2):21, 2023. https://doi.org/10.1007/s00285-022-01855-8 PMID: 36625974
- [35] Ghosh Samiran, Banerjee Malay, and Volpert Vitaly. Immuno-epidemiological model-based prediction of further covid-19 epidemic outbreaks due to immunity waning. *Mathematical Modelling of Natural Phe- nomena*, 17:9, 2022. https://doi.org/10.1051/mmnp/2022017
- [36] https://in.mathworks.com/products/curvefitting.html.
- [37] Ebrahim Fawzi, Tabal Salah, Lamami Yosra, Alhudiri Inas M, El Meshri Salah Edin, Al Dwigen Samira M, et al. Anti-sars-cov-2 igg antibodies after recovery from covid-19 or vaccination in libyan population: comparison of four vaccines. https://doi.org/10.1101/2022.02.18.22271130, 2022.
- [38] Berec Ludek, Smid Martin, Pribylova Lenka, Majek Ondrej, Pavlik Tomas, Jarkovsky Jiri, et al. Real-life protection provided by vaccination, booster doses and previous infection against covid-19 infection, hospitalisation or death over time in the czech republic: a whole country retrospective view. https://doi. org/10.1101/2021.12.10.21267590, 2021.
- [39] Chan Michael CW, Hui Kenrie PY, Ho John, Cheung Man-chun, Ng Ka-chun, Ching Rachel, et al. Sarscov-2 omicron variant replication in human respiratory tract ex vivo. https://doi.org/10.21203/rs.3.rs- 1189219/v1, 2021.
- [40] Quilty Billy J, Pulliam Juliet RC, and Pearson Carl AB. Test to release from isolation after testing positive for sars-cov-2. *medRxiv*, pages 2022–01, 2022.
- [41] Bailey Norman TJ. A statistical method of estimating the periods of incubation and infection of an infectious disease. *Nature*, 174:139–140, 1954. https://doi.org/10.1038/174139a0 PMID: 13185266
- [42] Chowell Gerardo, Hyman James M, Bettencourt Luı´s MA, Castillo-Chavez Carlos, and Nishiura H. *Mathematical and statistical estimation approaches in epidemiology*. Springer, 2009.
- [43] Lloyd Alun L. Realistic distributions of infectious periods in epidemic models: changing patterns of persistence and dynamics. *Theoretical population biology*, 60(1):59–71, 2001. https://doi.org/10.1006/ tpbi.2001.1525 PMID: 11589638
- [44] https://www.who.int/teams/immunization-vaccines-and-biologicals/essential-programme-onimmunization/implementation/immunization-campaigns.
- [45] https://measlesrubellapartnership.org/.
